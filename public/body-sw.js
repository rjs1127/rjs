'use strict';

// Public TXT bodies only. Change the namespace when this storage format/policy changes.
const BODY_CACHE_PREFIX = 'rjs-body-';
const BODY_CACHE = `${BODY_CACHE_PREFIX}v960`;
const MAX_BYTES = 32 * 1024 * 1024;
const MAX_ITEM_BYTES = 8 * 1024 * 1024;
const MAX_ITEMS = 40;
let mutations = Promise.resolve();
let archiveIds = null;
const requests = new Map();
const unavailableIds = new Set();

function mutate(task) {
  const pending = mutations.then(task);
  mutations = pending.catch(() => {});
  return pending;
}

function bodyKey(id) {
  return new Request(`${self.location.origin}/api/content?id=${encodeURIComponent(id)}&raw=1`);
}

async function getCachedBodyIds() {
  const cache = await caches.open(BODY_CACHE);
  const ids = [];
  for (const request of await cache.keys()) {
    const id = new URL(request.url).searchParams.get('id');
    if (id) ids.push(id);
  }
  return ids;
}

async function notifyClients() {
  const ids = await getCachedBodyIds();
  const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  for (const client of clients) client.postMessage({ type: 'offline-bodies-changed', ids });
}

async function pruneArchive(response) {
  if (response.status !== 200) return;
  const data = await response.json();
  if (!Array.isArray(data.items) || !data.items.every(item => typeof item?.id === 'string' && item.id)) return;
  archiveIds = new Set(data.items.map(item => item.id));
  const cache = await caches.open(BODY_CACHE);
  let changed = false;
  for (const key of await cache.keys()) {
    if (!archiveIds.has(new URL(key.url).searchParams.get('id'))) {
      changed = (await cache.delete(key)) || changed;
    }
  }
  if (changed) await notifyClients();
}

async function storeBody(id, response, serial) {
  if (requests.get(id) !== serial || (archiveIds && !archiveIds.has(id))) {
    response.body?.cancel().catch(() => {});
    return;
  }
  const length = Number(response.headers.get('content-length') || response.headers.get('x-content-bytes'));
  if (length > MAX_ITEM_BYTES) {
    response.body?.cancel().catch(() => {});
    return;
  }
  const reader = response.body?.getReader();
  if (!reader) return;
  const chunks = [];
  let bytes = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    bytes += value.byteLength;
    if (bytes > MAX_ITEM_BYTES) {
      reader.cancel().catch(() => {});
      return;
    }
    chunks.push(value);
  }
  if (requests.get(id) !== serial || (archiveIds && !archiveIds.has(id))) return;
  const cache = await caches.open(BODY_CACHE);
  const key = bodyKey(id);
  await cache.delete(key);
  let total = 0;
  const entries = [];
  for (const request of await cache.keys()) {
    const stored = await cache.match(request);
    const size = Number(stored.headers.get('x-content-bytes')) || MAX_ITEM_BYTES;
    total += size;
    entries.push({ request, size });
  }
  while (entries.length && (total + bytes > MAX_BYTES || entries.length >= MAX_ITEMS)) {
    const oldest = entries.shift();
    await cache.delete(oldest.request);
    total -= oldest.size;
  }
  // Whitelist headers: never persist auth, cookies, timings, or user-specific metadata.
  const saved = new Response(new Blob(chunks), { headers: {
    'content-type': 'text/plain; charset=utf-8',
    'x-content-bytes': String(bytes),
    'x-offline-body': '1',
  } });
  try {
    await cache.put(key, saved.clone());
  } catch (error) {
    if (error?.name !== 'QuotaExceededError') throw error;
    // Browser quota can be below our cap. Evict oldest bodies and retry once.
    for (const entry of entries.slice(0, Math.max(1, Math.ceil(entries.length / 2)))) {
      await cache.delete(entry.request);
    }
    await cache.put(key, saved);
  }
  await notifyClients();
}

async function contentResponse(event, id) {
  const serial = (requests.get(id) || 0) + 1;
  requests.set(id, serial);
  let response;
  try {
    // Preserve original credentials for server recent-view tracking, bypass HTTP cache.
    response = await fetch(new Request(event.request, { cache: 'no-store' }));
  } catch (error) {
    if (event.request.signal.aborted || error?.name === 'AbortError') throw error;
    try {
      const cached = await mutate(async () => {
        if (unavailableIds.has(id) || (archiveIds && !archiveIds.has(id))) return null;
        const cache = await caches.open(BODY_CACHE);
        const key = bodyKey(id);
        const saved = await cache.match(key);
        if (saved) {
          // Cache insertion order is our LRU order.
          try {
            await cache.delete(key);
            await cache.put(key, saved.clone());
          } catch {}
        }
        return saved;
      });
      if (cached) return cached;
    } catch {} // Cache unavailable: keep the existing reader error flow.
    return new Response(JSON.stringify({ error: '오프라인 상태이며 이 작품의 저장된 본문이 없습니다. 인터넷 연결 후 다시 열어 주세요.' }), {
      status: 503, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
  }
  if (response.status === 404 || response.status === 410) {
    unavailableIds.add(id);
    await mutate(async () => {
      const cache = await caches.open(BODY_CACHE);
      if (await cache.delete(bodyKey(id))) await notifyClients();
    }).catch(() => {});
  } else if (response.status === 200 && response.headers.get('x-content-public') === '1'
    && response.headers.get('content-type')?.startsWith('text/plain') && !response.redirected) {
    unavailableIds.delete(id);
    const copy = response.clone();
    event.waitUntil(mutate(() => storeBody(id, copy, serial)).catch(() => {}));
  }
  // HTTP errors never fall back to an old body.
  return response;
}

self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  await mutate(async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(BODY_CACHE_PREFIX) && name !== BODY_CACHE) await caches.delete(name);
    }
  });
  await self.clients.claim();
  await notifyClients().catch(() => {});
})()));

self.addEventListener('message', event => {
  const type = event.data?.type;
  if (!['offline-bodies-list', 'offline-bodies-delete', 'offline-bodies-clear'].includes(type)) return;
  const port = event.ports?.[0];
  if (!port) return;
  event.waitUntil((async () => {
    try {
      if (type === 'offline-bodies-delete') {
        const ids = [...new Set((Array.isArray(event.data?.ids) ? event.data.ids : []).map(String).filter(id => /^[A-Za-z0-9_-]{10,200}$/.test(id)))];
        await mutate(async () => {
          const cache = await caches.open(BODY_CACHE);
          for (const id of ids) await cache.delete(bodyKey(id));
        });
        await notifyClients();
      } else if (type === 'offline-bodies-clear') {
        await mutate(async () => {
          await caches.delete(BODY_CACHE);
          await caches.open(BODY_CACHE);
        });
        await notifyClients();
      }
      port.postMessage({ ids: await getCachedBodyIds() });
    } catch (error) {
      port.postMessage({ ids: [], error: error?.message || '오프라인 저장을 처리하지 못했습니다.' });
    }
  })());
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname === '/api/content' && !event.request.headers.has('range') && url.searchParams.get('raw') === '1'
    && /^[A-Za-z0-9_-]{10,200}$/.test(url.searchParams.get('id') || '')
    && [...url.searchParams.keys()].every(key => ['id', 'raw', 'modified'].includes(key))) {
    event.respondWith(contentResponse(event, url.searchParams.get('id')));
  } else if (url.pathname === '/api/archive') {
    // Observe a successful list solely to remove bodies; never cache the list.
    event.respondWith((async () => {
      const response = await fetch(event.request);
      await mutate(() => pruneArchive(response.clone())).catch(() => {});
      return response;
    })());
  }
});

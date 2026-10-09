import { jsonResponse } from './_shared.js';

// Best-effort, isolate-local protection. No KV/D1 writes, persisted IPs or new bindings.
const MINUTE = 60000;
const MAX_ENTRIES = 12000;
const counters = new Map();
const sessions = new Map();
let lastSweep = 0;

function sweep(now) {
  if (now - lastSweep < MINUTE) return;
  lastSweep = now;
  for (const map of [counters, sessions]) {
    for (const [key, entry] of map) if (entry.expiresAt <= now) map.delete(key);
  }
}
function clientIp(request) {
  // Cloudflare supplies this header. Never trust client-controlled X-Forwarded-For.
  const ip = (request.headers.get('cf-connecting-ip') || '').trim().toLowerCase();
  return ip.length <= 45 && /^[0-9a-f:.]+$/.test(ip) ? ip : null;
}
function bucket(key, windowMs, now) {
  if (!key) return null;
  sweep(now);
  let entry = counters.get(key);
  if (entry && entry.expiresAt <= now) { counters.delete(key); entry = null; }
  if (!entry) {
    // Preserve existing counters at capacity; never globally block unrelated users.
    if (counters.size >= MAX_ENTRIES) return null;
    entry = { count: 0, expiresAt: now + windowMs };
    counters.set(key, entry);
  }
  return entry;
}
function retry(entry, maximum, now) {
  return entry && entry.count >= maximum ? Math.max(1, Math.ceil((entry.expiresAt - now) / 1000)) : 0;
}
function take(key, maximum, windowMs, now = Date.now()) {
  const entry = bucket(key, windowMs, now);
  const retryAfter = retry(entry, maximum, now);
  if (retryAfter) return { retryAfter };
  if (entry) entry.count++;
  return { retryAfter: 0, release: () => { if (entry) entry.count = Math.max(0, entry.count - 1); } };
}
function blocked(key, maximum, windowMs, now = Date.now()) {
  return retry(bucket(key, windowMs, now), maximum, now);
}
function limited(seconds) {
  return jsonResponse({ error: `요청이 너무 많습니다. ${seconds}초 후 다시 시도해 주세요.`, retryAfter: seconds }, 429, {
    'cache-control': 'no-store', 'retry-after': String(seconds),
  });
}
const ipKey = (request, prefix) => { const ip = clientIp(request); return ip ? `${prefix}:${ip}` : null; };

export function checkAnalyticsRequest(request) {
  const { retryAfter } = take(ipKey(request, 'analytics-ip'), 120, MINUTE);
  return retryAfter ? limited(retryAfter) : null;
}
export function admitAnalytics(request, visitorId, sessionId, signature) {
  const now = Date.now();
  const visit = take(`analytics-visitor:${visitorId}`, 30, MINUTE, now);
  if (visit.retryAfter) return { response: limited(visit.retryAfter) };
  sweep(now);
  const key = `${visitorId}:${sessionId}`;
  let entry = sessions.get(key);
  if (entry && entry.expiresAt <= now) { sessions.delete(key); entry = null; }
  if (entry && (entry.pending || (entry.signature === signature && now - entry.writtenAt < 2000))) {
    return { ignored: true, userLinked: entry.userLinked };
  }
  const reservations = [];
  if (!entry) {
    for (const [counterKey, maximum] of [[ipKey(request, 'analytics-new-ip'), 60], [`analytics-new-visitor:${visitorId}`, 20]]) {
      const ticket = take(counterKey, maximum, 10 * MINUTE, now);
      if (ticket.retryAfter) { reservations.forEach(r => r.release()); return { response: limited(ticket.retryAfter) }; }
      reservations.push(ticket);
    }
    entry = { expiresAt: now + 45 * MINUTE, writtenAt: 0, signature: '', userLinked: false, pending: false };
    if (sessions.size < MAX_ENTRIES) sessions.set(key, entry);
  }
  entry.pending = true;
  return {
    commit(userLinked) {
      entry.pending = false;
      entry.writtenAt = Date.now();
      entry.expiresAt = entry.writtenAt + 45 * MINUTE;
      entry.signature = signature;
      entry.userLinked = userLinked;
    },
    cancel() {
      entry.pending = false;
      if (!entry.writtenAt && sessions.get(key) === entry) sessions.delete(key);
      reservations.forEach(r => r.release());
    },
  };
}

export function checkSignup(request) {
  const attempt = take(ipKey(request, 'signup-attempt'), 10, 15 * MINUTE);
  const seconds = attempt.retryAfter || blocked(ipKey(request, 'signup-success'), 3, 15 * MINUTE);
  return seconds ? limited(seconds) : null;
}
export function reserveSignup(request) {
  const ticket = take(ipKey(request, 'signup-success'), 3, 15 * MINUTE);
  return { ...ticket, response: ticket.retryAfter ? limited(ticket.retryAfter) : null };
}

function loginKeys(request, userId, admin) {
  const ip = clientIp(request);
  if (!ip) return [];
  return admin ? [`admin-failure:${ip}`] : [`login-failure:${ip}`, `login-pair:${ip}:${/^[a-z0-9_-]{3,20}$/.test(userId) ? userId : '_invalid'}`];
}
export function checkLoginRequest(request, admin = false) {
  const attempt = take(ipKey(request, admin ? 'admin-attempt' : 'login-attempt'), admin ? 10 : 60, MINUTE);
  if (attempt.retryAfter) return limited(attempt.retryAfter);
  const seconds = blocked(ipKey(request, admin ? 'admin-failure' : 'login-failure'), admin ? 5 : 30, (admin ? 15 : 10) * MINUTE);
  return seconds ? limited(seconds) : null;
}
export function checkLoginAccount(request, userId) {
  const key = loginKeys(request, userId, false)[1];
  const attempts = take(key ? key + ':attempt' : null, 12, MINUTE);
  const seconds = attempts.retryAfter || blocked(key, 8, 5 * MINUTE);
  return seconds ? limited(seconds) : null;
}
export function recordLoginFailure(request, userId = '', admin = false) {
  const now = Date.now();
  loginKeys(request, userId, admin).forEach((key, index) => {
    const windowMs = (admin ? 15 : index ? 5 : 10) * MINUTE;
    const maximum = admin ? 5 : index ? 8 : 30;
    const entry = bucket(key, windowMs, now);
    if (entry && entry.count < maximum) {
      entry.count++;
      // A completed failure threshold starts a full cooldown; blocked retries never extend it.
      if (entry.count === maximum) entry.expiresAt = now + windowMs;
    }
  });
}
export function recordLoginSuccess(request, userId = '', admin = false) {
  loginKeys(request, userId, admin).forEach(key => counters.delete(key));
  // Keep request-volume limits even on success. An attacker cannot reset those by logging in.
}

// Delegated Drive sync: isolated best-effort brute-force protection by Cloudflare client IP.
// Does not share counters or failure blocks with the site owner/admin login.
export function checkGuestDriveSyncRequest(request) {
  const admission = take(ipKey(request, 'guest-drive-attempt'), 8, 60 * 1000);
  const seconds = admission.retryAfter || blocked(ipKey(request, 'guest-drive-failure'), 5, 30 * 60 * 1000);
  return seconds ? limited(seconds) : null;
}

export function recordGuestDriveSyncFailure(request) {
  const key = ipKey(request, 'guest-drive-failure');
  if (!key) return;
  const now = Date.now();
  const entry = bucket(key, 30 * 60 * 1000, now);
  if (entry && entry.count < 5) {
    entry.count++;
    if (entry.count === 5) entry.expiresAt = now + 30 * 60 * 1000;
  }
}

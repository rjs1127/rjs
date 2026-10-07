import { jsonResponse } from "../../_shared.js";
import {
  requireUser,
  ensurePersonalizationSchema,
  ensureQuoteFeedSchema,
  userErrorResponse,
} from "../../_user.js";

function cleanText(value, max = 200) {
  return String(value || "").trim().slice(0, max);
}

export async function onRequestGet(context) {
  try {
    const auth = await requireUser(context);
    await ensurePersonalizationSchema(auth.db);
    await ensureQuoteFeedSchema(auth.db);

    const section = new URL(context.request.url).searchParams.get("section") || "";
    if (section === "library") {
      const [quotes, notes] = await Promise.all([
        auth.db.prepare(`
          SELECT q.id, q.title, q.author, q.quote_text, q.work_id,
                 q.start_offset, q.end_offset, q.source_text, q.created_at,
                 CASE WHEN sq.quote_id IS NULL THEN 0 ELSE 1 END AS is_shared,
                 sq.shared_at
          FROM user_quotes q
          LEFT JOIN shared_quotes sq ON sq.quote_id = q.id AND sq.user_id = q.user_id
          WHERE q.user_id = ?
          ORDER BY q.created_at DESC, q.id DESC LIMIT 500
        `).bind(auth.userId).all(),
        auth.db.prepare(`
          SELECT id, work_id, title, author, note_text, quote_text,
                 start_offset, end_offset, created_at, updated_at
          FROM reader_notes
          WHERE user_id = ?
          ORDER BY created_at DESC, id DESC LIMIT 500
        `).bind(auth.userId).all(),
      ]);
      return jsonResponse({ ok:true, quotes:quotes?.results||[], notes:notes?.results||[] }, 200, { "cache-control":"no-store" });
    }
    if (section === "quotes") {
      const quotes = await auth.db.prepare(`
        SELECT q.id, q.title, q.author, q.quote_text, q.work_id,
               q.start_offset, q.end_offset, q.source_text, q.created_at,
               CASE WHEN sq.quote_id IS NULL THEN 0 ELSE 1 END AS is_shared,
               sq.shared_at
        FROM user_quotes q
        LEFT JOIN shared_quotes sq
          ON sq.quote_id = q.id AND sq.user_id = q.user_id
        WHERE q.user_id = ?
        ORDER BY q.created_at DESC, q.id DESC
        LIMIT 500
      `).bind(auth.userId).all();

      return jsonResponse({
        ok: true,
        quotes: quotes?.results || [],
      }, 200, { "cache-control": "no-store" });
    }

    const [user, likes, quotes] = await Promise.all([
      auth.db.prepare(`
        SELECT user_id, created_at
        FROM users
        WHERE user_id = ?
        LIMIT 1
      `).bind(auth.userId).first(),
      auth.db.prepare(`
        SELECT work_id, title, author, liked_at
        FROM user_likes
        WHERE user_id = ?
        ORDER BY liked_at DESC
        LIMIT 500
      `).bind(auth.userId).all(),
      auth.db.prepare(`
        SELECT q.id, q.title, q.author, q.quote_text, q.work_id,
               q.start_offset, q.end_offset, q.source_text, q.created_at,
               CASE WHEN sq.quote_id IS NULL THEN 0 ELSE 1 END AS is_shared,
               sq.shared_at
        FROM user_quotes q
        LEFT JOIN shared_quotes sq
          ON sq.quote_id = q.id AND sq.user_id = q.user_id
        WHERE q.user_id = ?
        ORDER BY q.created_at DESC, q.id DESC
        LIMIT 500
      `).bind(auth.userId).all(),
    ]);

    return jsonResponse({
      ok: true,
      user: {
        userId: auth.userId,
        createdAt: user?.created_at == null ? null : Number(user.created_at),
      },
      likes: likes?.results || [],
      quotes: quotes?.results || [],
    }, 200, { "cache-control": "no-store" });
  } catch (error) {
    return userErrorResponse(error);
  }
}

export async function onRequestPost(context) {
  try {
    const auth = await requireUser(context);
    await ensurePersonalizationSchema(auth.db);
    await ensureQuoteFeedSchema(auth.db);
    const body = await context.request.json();
    const action = String(body?.action || "").trim();
    const now = Date.now();

    if (action === "like") {
      const workId = cleanText(body?.workId, 300);
      const liked = body?.liked === true;
      if (!workId) return jsonResponse({ error: "작품 ID가 없습니다." }, 400);

      if (liked) {
        await auth.db.prepare(`
          INSERT INTO user_likes(user_id, work_id, title, author, liked_at)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(user_id, work_id) DO UPDATE SET
            title = excluded.title,
            author = excluded.author,
            liked_at = excluded.liked_at
        `).bind(
          auth.userId,
          workId,
          cleanText(body?.title, 300),
          cleanText(body?.author, 200),
          now
        ).run();
      } else {
        await auth.db.prepare(`
          DELETE FROM user_likes
          WHERE user_id = ? AND work_id = ?
        `).bind(auth.userId, workId).run();
      }

      return jsonResponse({ ok: true, liked, likedAt: liked ? now : null });
    }

    if (action === "quote_save") {
      const quoteText = cleanText(body?.quoteText, 4000);
      if (!quoteText) return jsonResponse({ error: "저장할 문장이 없습니다." }, 400);

      const title = cleanText(body?.title, 300);
      const author = cleanText(body?.author, 200);
      const workId = cleanText(body?.workId, 300);
      const startOffsetRaw = Number(body?.startOffset);
      const endOffsetRaw = Number(body?.endOffset);
      const hasLocation = Boolean(workId) && Number.isFinite(startOffsetRaw) && startOffsetRaw >= 0;
      const startOffset = hasLocation ? Math.floor(startOffsetRaw) : null;
      const endOffset = hasLocation && Number.isFinite(endOffsetRaw)
        ? Math.max(startOffset, Math.floor(endOffsetRaw))
        : null;
      const sourceText = hasLocation ? cleanText(body?.sourceText, 1200) : "";

      // One INSERT statement owns the duplicate check so rapid clicks/two tabs do not
      // create another row for the same saved sentence. Existing historical duplicates
      // are left untouched; this only prevents new duplicates from being added.
      let result;
      if (hasLocation) {
        result = await auth.db.prepare(`
          INSERT INTO user_quotes(
            user_id, title, author, quote_text,
            work_id, start_offset, end_offset, source_text, created_at
          )
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (
            SELECT 1
            FROM user_quotes
            WHERE user_id = ? AND quote_text = ? AND work_id = ? AND start_offset = ?
            LIMIT 1
          )
        `).bind(
          auth.userId,
          title,
          author,
          quoteText,
          workId,
          startOffset,
          endOffset,
          sourceText || null,
          now,
          auth.userId,
          quoteText,
          workId,
          startOffset
        ).run();
      } else {
        // POSTYPE/direct-input quotes have no TXT offset. Scope duplicate detection
        // by title+author as well so the same sentence in different works is allowed.
        result = await auth.db.prepare(`
          INSERT INTO user_quotes(
            user_id, title, author, quote_text,
            work_id, start_offset, end_offset, source_text, created_at
          )
          SELECT ?, ?, ?, ?, NULL, NULL, NULL, NULL, ?
          WHERE NOT EXISTS (
            SELECT 1
            FROM user_quotes
            WHERE user_id = ?
              AND quote_text = ?
              AND COALESCE(work_id, '') = ''
              AND COALESCE(title, '') = ?
              AND COALESCE(author, '') = ?
            LIMIT 1
          )
        `).bind(
          auth.userId,
          title,
          author,
          quoteText,
          now,
          auth.userId,
          quoteText,
          title,
          author
        ).run();
      }

      const created = Number(result?.meta?.changes || 0) > 0;
      if (!created) {
        const existing = hasLocation
          ? await auth.db.prepare(`
              SELECT q.id, q.title, q.author, q.quote_text, q.work_id,
                     q.start_offset, q.end_offset, q.source_text, q.created_at,
                     CASE WHEN sq.quote_id IS NULL THEN 0 ELSE 1 END AS is_shared,
                     sq.shared_at
              FROM user_quotes q
              LEFT JOIN shared_quotes sq ON sq.quote_id = q.id AND sq.user_id = q.user_id
              WHERE q.user_id = ? AND q.quote_text = ? AND q.work_id = ? AND q.start_offset = ?
              ORDER BY q.created_at DESC, q.id DESC
              LIMIT 1
            `).bind(auth.userId, quoteText, workId, startOffset).first()
          : await auth.db.prepare(`
              SELECT q.id, q.title, q.author, q.quote_text, q.work_id,
                     q.start_offset, q.end_offset, q.source_text, q.created_at,
                     CASE WHEN sq.quote_id IS NULL THEN 0 ELSE 1 END AS is_shared,
                     sq.shared_at
              FROM user_quotes q
              LEFT JOIN shared_quotes sq ON sq.quote_id = q.id AND sq.user_id = q.user_id
              WHERE q.user_id = ?
                AND q.quote_text = ?
                AND COALESCE(q.work_id, '') = ''
                AND COALESCE(q.title, '') = ?
                AND COALESCE(q.author, '') = ?
              ORDER BY q.created_at DESC, q.id DESC
              LIMIT 1
            `).bind(auth.userId, quoteText, title, author).first();

        if (existing) {
          return jsonResponse({ ok: true, created: false, quote: existing });
        }
        return jsonResponse({ error: "문장 저장 상태를 다시 확인해주세요." }, 409);
      }

      return jsonResponse({
        ok: true,
        created: true,
        quote: {
          id: Number(result?.meta?.last_row_id || 0),
          title,
          author,
          quoteText,
          workId,
          startOffset,
          endOffset,
          sourceText,
          createdAt: now,
        },
      });
    }


    if (action === "quote_location_update") {
      const id = Number(body?.id || 0);
      const workId = cleanText(body?.workId, 300);
      const startOffsetRaw = Number(body?.startOffset);
      const endOffsetRaw = Number(body?.endOffset);
      if (!Number.isInteger(id) || id <= 0 || !workId || !Number.isFinite(startOffsetRaw) || startOffsetRaw < 0) {
        return jsonResponse({ error: "저장 문장 위치 정보가 올바르지 않습니다." }, 400);
      }
      const startOffset = Math.floor(startOffsetRaw);
      const endOffset = Number.isFinite(endOffsetRaw)
        ? Math.max(startOffset, Math.floor(endOffsetRaw))
        : startOffset;
      const sourceText = cleanText(body?.sourceText, 1200);

      const result = await auth.db.prepare(`
        UPDATE user_quotes
        SET work_id = ?, start_offset = ?, end_offset = ?, source_text = ?
        WHERE user_id = ? AND id = ?
      `).bind(
        workId,
        startOffset,
        endOffset,
        sourceText || null,
        auth.userId,
        id
      ).run();

      if (!Number(result?.meta?.changes || 0)) {
        return jsonResponse({ error: "저장 문장을 찾을 수 없습니다." }, 404);
      }

      return jsonResponse({
        ok: true,
        location: { workId, startOffset, endOffset, sourceText },
      });
    }

    if (action === "quote_share") {
      const id = Number(body?.id || 0);
      const shared = body?.shared === true;
      if (!Number.isInteger(id) || id <= 0) {
        return jsonResponse({ error: "저장 문장 ID가 올바르지 않습니다." }, 400);
      }

      if (shared) {
        const nextWorkId = cleanText(body?.workId, 300);

        // 공개 행은 현재 사용자의 개인 문장이 실제로 존재하는 순간에만 만든다.
        // SELECT 후 별도 INSERT를 하지 않아 다른 탭의 quote_delete와 겹쳐도
        // 삭제된 문장이 늦게 다시 공개 피드에 남는 고아 행을 만들지 않는다.
        const result = await auth.db.prepare(`
          INSERT INTO shared_quotes(quote_id, user_id, work_id, title, author, quote_text, shared_at)
          SELECT q.id, q.user_id, ?, q.title, q.author, q.quote_text, ?
          FROM user_quotes q
          WHERE q.user_id = ? AND q.id = ?
          ON CONFLICT(quote_id) DO UPDATE SET
            user_id = excluded.user_id,
            work_id = excluded.work_id,
            title = excluded.title,
            author = excluded.author,
            quote_text = excluded.quote_text
        `).bind(
          nextWorkId,
          now,
          auth.userId,
          id
        ).run();

        if (!Number(result?.meta?.changes || 0)) {
          return jsonResponse({ error: "저장 문장을 찾을 수 없습니다." }, 404);
        }

        const current = await auth.db.prepare(`
          SELECT shared_at
          FROM shared_quotes
          WHERE quote_id = ? AND user_id = ?
          LIMIT 1
        `).bind(id, auth.userId).first();

        // 바로 뒤에서 다른 탭이 원문을 삭제했다면 quote_delete가 공개 행도
        // 함께 지운다. 그 경우 성공으로 오인하지 않고 현재 상태를 알려준다.
        if (!current) {
          return jsonResponse({ error: "저장 문장이 삭제되어 공개하지 않았습니다." }, 409);
        }

        return jsonResponse({
          ok: true,
          shared: true,
          sharedAt: Number(current.shared_at || now),
          changed: true,
        });
      }

      await auth.db.prepare(`
        DELETE FROM shared_quotes
        WHERE quote_id = ? AND user_id = ?
      `).bind(id, auth.userId).run();
      return jsonResponse({ ok: true, shared: false, sharedAt: null });
    }

    if (action === "note_save") {
      const workId = cleanText(body?.workId, 300);
      const noteText = cleanText(body?.noteText, 4000);
      if (!workId || !noteText) return jsonResponse({ error: "작품과 메모 내용을 확인해 주세요." }, 400);
      const startRaw = Number(body?.startOffset);
      const endRaw = Number(body?.endOffset);
      const startOffset = Number.isFinite(startRaw) && startRaw >= 0 ? Math.floor(startRaw) : null;
      const endOffset = startOffset != null && Number.isFinite(endRaw) ? Math.max(startOffset, Math.floor(endRaw)) : startOffset;
      const quoteText = cleanText(body?.quoteText, 1200);
      const result = await auth.db.prepare(`
        INSERT INTO reader_notes(user_id, work_id, title, author, note_text, quote_text, start_offset, end_offset, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(auth.userId, workId, cleanText(body?.title,300), cleanText(body?.author,200), noteText, quoteText||null, startOffset, endOffset, now, now).run();
      return jsonResponse({ ok:true, note:{ id:Number(result?.meta?.last_row_id||0), workId, title:cleanText(body?.title,300), author:cleanText(body?.author,200), noteText, quoteText, startOffset, endOffset, createdAt:now, updatedAt:now } });
    }

    if (action === "note_update") {
      const id = Number(body?.id || 0);
      const noteText = cleanText(body?.noteText, 4000);
      if (!Number.isInteger(id) || id <= 0) return jsonResponse({ error:"메모 ID가 올바르지 않습니다." },400);
      if (!noteText) return jsonResponse({ error:"메모 내용을 입력해 주세요." },400);
      const existing = await auth.db.prepare(`
        SELECT id, work_id, title, author, note_text, quote_text, start_offset, end_offset, created_at, updated_at
        FROM reader_notes WHERE user_id = ? AND id = ? LIMIT 1
      `).bind(auth.userId,id).first();
      if (!existing) return jsonResponse({ error:"메모를 찾을 수 없습니다." },404);
      await auth.db.prepare(`UPDATE reader_notes SET note_text = ?, updated_at = ? WHERE user_id = ? AND id = ?`)
        .bind(noteText,now,auth.userId,id).run();
      return jsonResponse({ok:true,note:{...existing,note_text:noteText,updated_at:now}});
    }

    if (action === "note_delete") {
      const id = Number(body?.id||0);
      if (!Number.isInteger(id) || id <= 0) return jsonResponse({ error:"메모 ID가 올바르지 않습니다." },400);
      await auth.db.prepare(`DELETE FROM reader_notes WHERE user_id = ? AND id = ?`).bind(auth.userId,id).run();
      return jsonResponse({ok:true});
    }

    if (action === "quote_delete") {
      const id = Number(body?.id || 0);
      if (!Number.isInteger(id) || id <= 0) {
        return jsonResponse({ error: "저장 문장 ID가 올바르지 않습니다." }, 400);
      }
      await auth.db.batch([
        auth.db.prepare(`
          DELETE FROM shared_quotes
          WHERE user_id = ? AND quote_id = ?
        `).bind(auth.userId, id),
        auth.db.prepare(`
          DELETE FROM user_quotes
          WHERE user_id = ? AND id = ?
        `).bind(auth.userId, id),
      ]);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "지원하지 않는 작업입니다." }, 400);
  } catch (error) {
    return userErrorResponse(error);
  }
}

let feedbackSchemaReadyPromise = null;

async function ensureFeedbackSchema(db) {
  if (feedbackSchemaReadyPromise) return feedbackSchemaReadyPromise;

  feedbackSchemaReadyPromise = (async () => {
    await db.prepare(`
      CREATE TABLE IF NOT EXISTS feedback (
        feedback_id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        message TEXT NOT NULL,
        page TEXT,
        version TEXT,
        diagnostic TEXT,
        account_user_id TEXT,
        reply_contact TEXT,
        status TEXT NOT NULL DEFAULT 'new',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `).run();

    const info = await db.prepare("PRAGMA table_info(feedback)").all();
    const columns = new Set((info?.results || []).map((column) => String(column?.name || "")));
    const migrations = [
      ["diagnostic", `ALTER TABLE feedback ADD COLUMN diagnostic TEXT`],
      ["account_user_id", `ALTER TABLE feedback ADD COLUMN account_user_id TEXT`],
      ["reply_contact", `ALTER TABLE feedback ADD COLUMN reply_contact TEXT`],
    ];

    for (const [column, sql] of migrations) {
      if (columns.has(column)) continue;
      try {
        await db.prepare(sql).run();
      } catch (error) {
        if (!/duplicate column/i.test(String(error?.message || ""))) throw error;
      }
    }

    await db.prepare(`
      CREATE INDEX IF NOT EXISTS idx_feedback_status_created
      ON feedback(status, created_at DESC)
    `).run();
  })().catch((error) => {
    feedbackSchemaReadyPromise = null;
    throw error;
  });

  return feedbackSchemaReadyPromise;
}

export { ensureFeedbackSchema };

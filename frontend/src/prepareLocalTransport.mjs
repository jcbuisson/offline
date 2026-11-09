// Changing PouchDB adapters creates a new local change sequence. Reset only the
// transport cursor; keep authoritative rows, applied sequence and offline edits.
export async function prepareLocalTransport(db, name) {
   await db.transaction(async tx => {
      await tx.exec('CREATE TABLE IF NOT EXISTS offline_sync_transport (id INTEGER PRIMARY KEY CHECK (id = 1), name TEXT NOT NULL)')
      const prior = (await tx.query('SELECT name FROM offline_sync_transport WHERE id = 1')).rows[0]
      if (prior?.name === name) return
      const { rows } = await tx.query("SELECT to_regclass('pgcouch_local_state') IS NOT NULL AS exists")
      if (rows[0].exists) await tx.query("UPDATE pgcouch_local_state SET cursor = '0'::jsonb WHERE id = 1")
      await tx.query('INSERT INTO offline_sync_transport VALUES (1, $1) ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name', [name])
   })
}

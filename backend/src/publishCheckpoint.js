import { randomUUID } from 'node:crypto'
import { isDeepStrictEqual } from 'node:util'
import models from './syncModels.js'

const json = value => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? String(item) : item)

async function transaction(db, run) {
   if (typeof db.connect !== 'function') return db.transaction(run)
   const tx = await db.connect()
   try {
      await tx.query('BEGIN')
      const result = await run(tx)
      await tx.query('COMMIT')
      return result
   } catch (error) {
      await tx.query('ROLLBACK')
      throw error
   } finally { tx.release() }
}

// Append a full snapshot at a new sequence. Keep every older receipt/document.
export async function publishCheckpoint(db, couch, { minimumSequence = '0' } = {}) {
   const receiptId = `checkpoint:${randomUUID()}`
   const decision = await transaction(db, async tx => {
      const { rows } = await tx.query('SELECT sequence FROM pgcouch_state WHERE id = 1 FOR UPDATE')
      if (rows.length !== 1) throw new Error('PGCouch must be initialized before creating a checkpoint')
      // The state lock orders plugin writes; table locks also exclude direct SQL
      // writes while reading a consistent snapshot across all related tables.
      await tx.query(`LOCK TABLE ${models.map(model => `"${model.name}"`).join(', ')} IN SHARE MODE`)
      const snapshot = {}
      for (const model of models) snapshot[model.name] = (await tx.query(`SELECT * FROM "${model.name}" ORDER BY "${model.primaryKey}"`)).rows
      const sequence = String((BigInt(rows[0].sequence) > BigInt(minimumSequence)
         ? BigInt(rows[0].sequence) : BigInt(minimumSequence)) + 1n)
      const doc = JSON.parse(json({ _id: `result:${receiptId}`, type: 'result', status: 'accepted', sequence, changes: [], snapshot }))
      await tx.query('UPDATE pgcouch_state SET sequence = $1 WHERE id = 1', [sequence])
      await tx.query('INSERT INTO pgcouch_receipts (id, decision) VALUES ($1, $2::jsonb)', [receiptId, json(doc)])
      return doc
   })
   // A running backend may publish the durable outbox before this process does.
   try { await couch.put(decision) }
   catch (error) {
      if (error.status !== 409) throw error
      const { _rev, _conflicts, ...existing } = await couch.get(decision._id)
      if (!isDeepStrictEqual(existing, decision)) throw new Error('Checkpoint document conflicts with its PostgreSQL receipt')
   }
   await db.query('UPDATE pgcouch_receipts SET published = true WHERE id = $1', [receiptId])
   return { sequence: decision.sequence, rows: Object.fromEntries(Object.entries(decision.snapshot).map(([table, rows]) => [table, rows.length])) }
}

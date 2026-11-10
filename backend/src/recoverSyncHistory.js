import { isDeepStrictEqual } from 'node:util'
import { publishCheckpoint } from './publishCheckpoint.js'

const clean = ({ _rev, _conflicts, ...body }) => body

// Operator recovery only: every backend sharing this CouchDB must be stopped.
// Keep PostgreSQL rows authoritative and preserve every original decision.
export async function recoverSyncHistory(db, couch) {
   const { rows } = await couch.allDocs({ include_docs: true, conflicts: true })
   const docs = new Map()
   let maximum = 0n
   for (const { doc } of rows) {
      if (!doc || (!doc._id.startsWith('transaction:') && !doc._id.startsWith('result:'))) continue
      if (doc._conflicts?.length) throw new Error('Resolve conflicting CouchDB revisions before recovery')
      docs.set(doc._id, clean(doc))
      if (doc._id.startsWith('result:')) {
         if (!/^\d+$/.test(doc.sequence)) throw new Error('Invalid result sequence')
         if (BigInt(doc.sequence) > maximum) maximum = BigInt(doc.sequence)
      }
   }
   const receipts = (await db.query('SELECT id, proposal, decision FROM pgcouch_receipts')).rows
   const known = new Set(receipts.map(row => row.id))
   const conflicts = []
   for (const receipt of receipts) {
      const proposal = docs.get(receipt.id)
      if (proposal && receipt.proposal && !isDeepStrictEqual(proposal, receipt.proposal)) {
         throw new Error('A transaction ID has different proposals; automatic recovery refused')
      }
      const existing = docs.get(receipt.decision._id)
      if (existing && !isDeepStrictEqual(existing, receipt.decision)) conflicts.push({ receipt, existing })
   }
   const imports = []
   for (const doc of docs.values()) {
      if (doc.type !== 'result' || !doc.transactionId || known.has(doc.transactionId)) continue
      const proposal = docs.get(doc.transactionId)
      if (!proposal || doc._id !== `result:${doc.transactionId.slice(12)}`) {
         throw new Error('Foreign decision has no matching proposal; automatic recovery refused')
      }
      imports.push({ proposal, decision: doc })
   }
   // Publish above BOTH histories before unblocking anything. Failure leaves the
   // original receipts pending; rerunning is safe and appends another checkpoint.
   const checkpoint = await publishCheckpoint(db, couch, { minimumSequence: String(maximum) })
   const tx = typeof db.connect === 'function' ? await db.connect() : null
   const finish = async connection => {
      await connection.query('SELECT sequence FROM pgcouch_state WHERE id = 1 FOR UPDATE')
      await connection.query(`CREATE TABLE IF NOT EXISTS pgcouch_recovery_audit (
         receipt_id TEXT NOT NULL, checkpoint_sequence TEXT NOT NULL,
         postgres_decision JSONB NOT NULL, couch_decision JSONB NOT NULL,
         PRIMARY KEY (receipt_id, checkpoint_sequence)
      )`)
      for (const { receipt, existing } of conflicts) {
         await connection.query(`INSERT INTO pgcouch_recovery_audit VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
            [receipt.id, checkpoint.sequence, JSON.stringify(receipt.decision), JSON.stringify(existing)])
         // 'published' now means covered by the audited recovery checkpoint.
         await connection.query('UPDATE pgcouch_receipts SET published = true WHERE id = $1', [receipt.id])
      }
      for (const { proposal, decision } of imports) {
         // Do not execute proposals already decided by the other backend again.
         await connection.query(`INSERT INTO pgcouch_receipts (id, proposal, decision, published)
            VALUES ($1, $2::jsonb, $3::jsonb, true)`, [proposal._id, JSON.stringify(proposal), JSON.stringify(decision)])
      }
   }
   if (tx) {
      try { await tx.query('BEGIN'); await finish(tx); await tx.query('COMMIT') }
      catch (error) { await tx.query('ROLLBACK'); throw error }
      finally { tx.release() }
   } else await db.transaction(finish)
   return { checkpoint, superseded: conflicts.length, imported: imports.length }
}

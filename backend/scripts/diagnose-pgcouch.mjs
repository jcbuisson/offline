import 'dotenv/config'
import { createHash } from 'node:crypto'
import { Pool } from 'pg'
import PouchDB from 'pouchdb'

// Print protocol metadata and hashes only: no credentials or application rows.
function canonical(value) {
   if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
   if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
   return JSON.stringify(value)
}
function summary(doc) {
   if (!doc) return null
   const { _rev, _conflicts, ...body } = doc
   return {
      id: body._id, sequence: body.sequence,
      hash: createHash('sha256').update(canonical(body)).digest('hex'),
      snapshotRows: Object.fromEntries(Object.entries(body.snapshot ?? {}).map(([table, rows]) => [table, rows.length])),
   }
}

if (!process.env.DATABASE_URL || !process.env.COUCH_DATABASE_URL) {
   throw new Error('Set DATABASE_URL and COUCH_DATABASE_URL using the production backend environment')
}
const db = new Pool({ connectionString: process.env.DATABASE_URL })
const couch = new PouchDB(process.env.COUCH_DATABASE_URL, { skip_setup: true })
try {
   await db.query('BEGIN READ ONLY')
   const state = (await db.query('SELECT sequence FROM pgcouch_state WHERE id = 1')).rows
   const receipts = (await db.query(`SELECT count(*)::text AS total,
      count(*) FILTER (WHERE NOT published)::text AS unpublished
      FROM pgcouch_receipts`)).rows[0]
   const bootstrap = (await db.query("SELECT published, decision FROM pgcouch_receipts WHERE id = 'bootstrap'")).rows[0]
   const next = (await db.query(`SELECT id, decision FROM pgcouch_receipts WHERE NOT published
      ORDER BY (decision->>'sequence')::bigint LIMIT 1`)).rows[0]
   await db.query('COMMIT')
   async function get(id) {
      try { return await couch.get(id) }
      catch (error) { if (error.status === 404) return null; throw error }
   }
   const sqlBootstrap = summary(bootstrap?.decision)
   const couchBootstrap = summary(await get('result:bootstrap'))
   const sqlNext = summary(next?.decision)
   const couchNext = next ? summary(await get(next.decision._id)) : null
   console.log(JSON.stringify({
      postgres: { state, receipts, bootstrapPublished: bootstrap?.published, bootstrap: sqlBootstrap },
      couch: { bootstrap: couchBootstrap },
      bootstrapMatches: sqlBootstrap && couchBootstrap ? sqlBootstrap.hash === couchBootstrap.hash : null,
      nextUnpublished: next ? { receiptId: next.id, postgres: sqlNext, couch: couchNext,
         matches: couchNext ? sqlNext.hash === couchNext.hash : null } : null,
   }, null, 2))
} catch (error) {
   // Driver messages can contain connection details; keep output safe to share.
   console.error('Diagnostic failed:', { code: error.code, status: error.status, name: error.name })
   process.exitCode = 1
} finally {
   await couch.close()
   await db.end()
}

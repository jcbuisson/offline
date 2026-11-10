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
      type: body.type, status: body.status, transactionId: body.transactionId,
      fields: Object.keys(body).sort(),
      fieldHashes: Object.fromEntries(Object.entries(body).map(([key, value]) => [key,
         createHash('sha256').update(canonical(value)).digest('hex')])),
      changeCounts: Object.fromEntries([...new Set((body.changes ?? []).map(change => change.table))]
         .map(table => [table, body.changes.filter(change => change.table === table).length])),
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
   const target = new URL(process.env.COUCH_DATABASE_URL)
   console.log('Configured CouchDB target:', {
      server: target.origin, database: target.pathname,
      username: decodeURIComponent(target.username),
   })
   const couchInfo = await couch.info()
   const proposals = await couch.allDocs({ include_docs: true, startkey: 'transaction:', endkey: 'transaction:\uffff', limit: 100 })
   const transactionIds = proposals.rows.map(row => row.id)
   const previousIds = proposals.rows.map(row => row.doc?.previous).filter(Boolean)
   const resultIds = transactionIds.map(id => `result:${id.slice(12)}`)
   const results = resultIds.length ? await couch.allDocs({ keys: resultIds }) : { rows: [] }
   const publishedResults = new Set(results.rows.filter(row => !row.error && !row.value?.deleted).map(row => row.id))
   await db.query('BEGIN READ ONLY')
   const database = (await db.query('SELECT current_database() AS name')).rows[0].name
   const rowCounts = {}
   for (const table of ['user', 'group', 'user_group_relation']) {
      rowCounts[table] = (await db.query(`SELECT count(*)::text AS count FROM "${table}"`)).rows[0].count
   }
   const state = (await db.query('SELECT sequence FROM pgcouch_state WHERE id = 1')).rows
   const receipts = (await db.query(`SELECT count(*)::text AS total,
      count(*) FILTER (WHERE NOT published)::text AS unpublished
      FROM pgcouch_receipts`)).rows[0]
   const bootstrap = (await db.query("SELECT published, decision FROM pgcouch_receipts WHERE id = 'bootstrap'")).rows[0]
   const next = (await db.query(`SELECT id, decision FROM pgcouch_receipts WHERE NOT published
      ORDER BY (decision->>'sequence')::bigint LIMIT 1`)).rows[0]
   const matchingReceipts = (await db.query(`SELECT id, published, decision->>'sequence' AS sequence,
      decision->>'status' AS status FROM pgcouch_receipts WHERE id = ANY($1::text[])`,
      [[...new Set([...transactionIds, ...previousIds])]])).rows
   const byId = new Map(matchingReceipts.map(receipt => [receipt.id, receipt]))
   await db.query('COMMIT')
   async function get(id) {
      try { return await couch.get(id) }
      catch (error) { if (error.status === 404) return null; throw error }
   }
   const sqlBootstrap = summary(bootstrap?.decision)
   const couchBootstrap = summary(await get('result:bootstrap'))
   const sqlNext = summary(next?.decision)
   const couchNext = next ? summary(await get(next.decision._id)) : null
   const differingFields = sqlNext && couchNext ? [...new Set([...sqlNext.fields, ...couchNext.fields])]
      .filter(key => sqlNext.fieldHashes[key] !== couchNext.fieldHashes[key]) : null
   console.log(JSON.stringify({
      postgres: { database, rowCounts, state, receipts, bootstrapPublished: bootstrap?.published, bootstrap: sqlBootstrap },
      couch: { database: couchInfo.db_name, path: new URL(process.env.COUCH_DATABASE_URL).pathname, bootstrap: couchBootstrap },
      // Protocol identifiers and statuses only; never print mutation data.
      transactions: {
         scanned: proposals.rows.length, limitedTo: 100,
         awaitingServer: proposals.rows.filter(row => !byId.has(row.id) && !publishedResults.has(`result:${row.id.slice(12)}`)).map(row => ({
            id: row.id, previous: row.doc?.previous ?? null,
            missingPreviousReceipt: Boolean(row.doc?.previous && !byId.has(row.doc.previous)),
         })),
         committedWithoutCouchResult: transactionIds.filter(id => byId.has(id) && !publishedResults.has(`result:${id.slice(12)}`)).map(id => byId.get(id)),
         couchResultsWithoutPostgresReceipt: transactionIds.filter(id => !byId.has(id) && publishedResults.has(`result:${id.slice(12)}`)),
      },
      bootstrapMatches: sqlBootstrap && couchBootstrap ? sqlBootstrap.hash === couchBootstrap.hash : null,
      nextUnpublished: next ? { receiptId: next.id, postgres: sqlNext, couch: couchNext,
         differingFields,
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

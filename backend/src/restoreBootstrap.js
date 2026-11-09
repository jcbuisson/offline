// A replacement CouchDB database needs the original sequence-zero snapshot,
// even when PostgreSQL already marked its receipt as published to the old one.
export async function restoreMissingBootstrap(sync, db, couch) {
   await sync.ready
   try {
      await couch.get('result:bootstrap')
      return false
   } catch (error) {
      if (error.status !== 404) throw error
   }
   const { rows } = await db.query("UPDATE pgcouch_receipts SET published = false WHERE id = 'bootstrap' RETURNING id")
   if (rows.length !== 1) throw new Error('Missing PostgreSQL bootstrap receipt; cannot restore sync history')
   // Publish through the regular immutable outbox. Never reconstruct a snapshot
   // from today's rows or overwrite an existing CouchDB protocol document.
   await sync.flushQueue()
   return true
}

import 'dotenv/config'
import { Pool } from 'pg'
import PouchDB from 'pouchdb'
import { publishCheckpoint } from '../src/publishCheckpoint.js'

if (!process.env.DATABASE_URL || !process.env.COUCH_DATABASE_URL) throw new Error('Set DATABASE_URL and COUCH_DATABASE_URL in the production backend environment')
const db = new Pool({ connectionString: process.env.DATABASE_URL })
const couch = new PouchDB(process.env.COUCH_DATABASE_URL, { skip_setup: true })
try {
   console.log('CouchDB database:', (await couch.info()).db_name)
   console.log('Published authoritative PGCouch checkpoint:', await publishCheckpoint(db, couch))
} catch (error) {
   console.error('Checkpoint failed:', { code: error.code, status: error.status, name: error.name })
   console.error('Any committed checkpoint receipt remains in the durable outbox for the backend to retry.')
   process.exitCode = 1
} finally {
   await couch.close()
   await db.end()
}

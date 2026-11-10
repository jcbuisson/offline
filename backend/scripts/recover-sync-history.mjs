import 'dotenv/config'
import { Pool } from 'pg'
import PouchDB from 'pouchdb'
import { recoverSyncHistory } from '../src/recoverSyncHistory.js'

if (!process.argv.includes('--backends-stopped')) throw new Error('Stop ALL backends sharing this CouchDB, then pass --backends-stopped')
if (!process.env.DATABASE_URL || !process.env.COUCH_DATABASE_URL) throw new Error('Set DATABASE_URL and COUCH_DATABASE_URL')
const db = new Pool({ connectionString: process.env.DATABASE_URL })
const couch = new PouchDB(process.env.COUCH_DATABASE_URL, { skip_setup: true })
try {
   console.log('Recovering CouchDB:', (await couch.info()).db_name)
   console.log('Recovery complete:', await recoverSyncHistory(db, couch))
} catch (error) {
   console.error('Recovery failed:', { name: error.name, code: error.code, status: error.status })
   console.error('Keep backends stopped. Original records remain intact; recovery can be rerun.')
   process.exitCode = 1
} finally {
   await couch.close()
   await db.end()
}

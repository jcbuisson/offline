import 'dotenv/config'
import PouchDB from 'pouchdb'
import { pgcouchValidationDocument } from '@jcbuisson/express-x-plugins/pgcouch-server'

// Admin credentials are used only for provisioning, never in the browser.
const url = process.env.COUCH_ADMIN_DATABASE_URL
if (!url) throw new Error('Set COUCH_ADMIN_DATABASE_URL (including database name)')
const couch = new PouchDB(url)
try {
   await couch.info()
   const validator = pgcouchValidationDocument()
   try { await couch.get(validator._id) }
   catch (error) {
      if (error.status !== 404) throw error
      await couch.put(validator)
   }
   console.log('PGCouch database and validator ready; configure _security and application accounts before replication.')
} finally { await couch.close() }

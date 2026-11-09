import { startPGCouchWorker } from '@jcbuisson/express-x-plugins/pgcouch-worker'
import schema from './local-schema.sql?raw'

startPGCouchWorker({
   schema,
   models: ['user', 'group', 'user_group_relation'],
   remote: import.meta.env.VITE_COUCH_DATABASE_URL || '/couchdb/offline',
   storagePrefix: 'offline',
})

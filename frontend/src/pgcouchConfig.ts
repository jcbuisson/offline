import { storageForRemote } from './pgcouchStorage.mjs'

export const pgcouchConfig = await storageForRemote(
   import.meta.env.VITE_COUCH_DATABASE_URL || '/couchdb/offline',
   globalThis.location.origin,
)

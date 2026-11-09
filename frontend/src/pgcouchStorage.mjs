import { storageForRemote as pluginStorageForRemote } from '@jcbuisson/express-x-plugins/pgcouch-storage'

// Preserve the app's existing namespace and offline edits across this move.
export const storageForRemote = (remote, origin) => pluginStorageForRemote(remote, origin, 'offline')

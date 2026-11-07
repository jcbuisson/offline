import 'dotenv/config'
import { expressX } from '@jcbuisson/express-x/server'
import { pgcouchServerPlugin } from '@jcbuisson/express-x-plugins/pgcouch-server'
import PouchDB from 'pouchdb'
import { reloadPlugin } from '@jcbuisson/express-x-plugins/reload-server'
import { Pool } from 'pg'

import channels from './channels.js'
import syncModels from './syncModels.js'
import { validateUserMutation } from './validateUser.js'

const app = expressX({
   WS_TRANSPORT: true,
   WS_PATH: '/offline-socket-io/',
})

const db = new Pool({ connectionString: process.env.DATABASE_URL })

if (!process.env.COUCH_DATABASE_URL) throw new Error('Set COUCH_DATABASE_URL to the authenticated CouchDB database URL')
const couch = new PouchDB(process.env.COUCH_DATABASE_URL)
const sync = pgcouchServerPlugin(app, db, syncModels, {
   couch,
   authorize(context, { modelName, action, args }) {
      if (modelName === 'user' && ['create', 'update'].includes(action)) {
         try { validateUserMutation({ args }, action) }
         catch { throw new TypeError("L'email doit être valide et non vide.") }
      }
      return true
   },
   onError: error => console.error('PGCouch sync failed', error),
})
await sync.ready

// allows socket data & room transfer on page reload
app.configure(reloadPlugin)

// publish
app.configure(channels)
// subscribe
app.on('connection', (socket) => {
   app.joinChannel('anonymous', socket)
})

const PORT = process.env.PORT || 3000
app.httpServer.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}`))

async function shutdown() {
   app.httpServer.close()
   await sync.dispose()
   await couch.close()
   await db.end()
}
process.once('SIGTERM', shutdown)
process.once('SIGINT', shutdown)

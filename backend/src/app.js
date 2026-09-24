import 'dotenv/config'
import { expressX } from '@jcbuisson/express-x/server'
import { electricServerPlugin, prepareElectricSyncSchema } from '@jcbuisson/express-x-plugins/electric-server'
import { reloadPlugin } from '@jcbuisson/express-x-plugins/reload-server'
import { Pool } from 'pg'

import channels from './channels.js'

const app = expressX({
   WS_TRANSPORT: true,
   WS_PATH: '/offline-socket-io/',
})

const db = new Pool({ connectionString: process.env.DATABASE_URL })

const syncModels = [
   { name: 'user', primaryKey: 'uid', tombstoneData: { email: null } },
   { name: 'group', primaryKey: 'uid', tombstoneData: { name: null } },
   { name: 'user_group_relation', primaryKey: 'uid', tombstoneData: { user_uid: null, group_uid: null } },
]
// add synchronization infrastructure
await prepareElectricSyncSchema(db, syncModels)

// Register PostgreSQL mutation services and proxy Electric Shapes to the client.
app.configure(electricServerPlugin, db, syncModels, {
   sync: true,
   electricUrl: process.env.ELECTRIC_URL || 'http://localhost:3001/v1/shape',
})

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

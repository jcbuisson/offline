import 'dotenv/config'
import { expressX } from '@jcbuisson/express-x/server'
import { electricOfflinePlugin } from '@jcbuisson/express-x-plugins/electric-server'
import { reloadPlugin } from '@jcbuisson/express-x-plugins/reload-server'
import { Pool } from 'pg'

import channels from './channels.js'
import { prepareSyncSchema, syncModels } from './sync-schema.js'

const app = expressX({
   WS_TRANSPORT: true,
   WS_PATH: '/offline-socket-io/',
})

const db = new Pool({ connectionString: process.env.DATABASE_URL })
await prepareSyncSchema(db)

// allows socket data & room transfer on page reload
app.configure(reloadPlugin)

// Register PostgreSQL mutation services and proxy Electric Shapes to the client.
app.configure(electricOfflinePlugin, db, syncModels, {
   sync: true,
   electricUrl: process.env.ELECTRIC_URL || 'http://localhost:3001/v1/shape',
})

// publish
app.configure(channels)
// subscribe
app.on('connection', (socket) => {
   app.joinChannel('anonymous', socket)
})

const PORT = process.env.PORT || 3000
app.httpServer.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}`))

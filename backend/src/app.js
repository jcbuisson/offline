import 'dotenv/config'
import { expressX } from '@jcbuisson/express-x/server'
import { electricSqlServerPlugin } from '@jcbuisson/express-x-plugins/electric-sql-server'
import { reloadPlugin } from '@jcbuisson/express-x-plugins/reload-server'
import { Pool } from 'pg'

import { tables, statements } from './sql.js'

const app = expressX({
   WS_TRANSPORT: true,
   WS_PATH: '/offline-socket-io/',
})

const db = new Pool({ connectionString: process.env.DATABASE_URL })

// This public demo allows all clients to use its named statements and Shapes.
app.configure(electricSqlServerPlugin, db, {
   tables,
   statements,
   authorize: () => true,
   electricUrl: process.env.ELECTRIC_URL || 'http://localhost:3001/v1/shape',
})

// allows socket data & room transfer on page reload
app.configure(reloadPlugin)

// subscribe
app.on('connection', (socket) => {
   app.joinChannel('anonymous', socket)
})

const PORT = process.env.PORT || 3000
app.httpServer.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}`))

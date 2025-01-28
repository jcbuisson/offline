import 'dotenv/config'

// import { expressX } from '@jcbuisson/express-x'
import { expressX } from './server.mjs'
import { PrismaClient } from '@prisma/client'
import channels from './channels.js'

const prisma = new PrismaClient()

const app = expressX({
   WS_TRANSPORT: true,
   WS_PATH: '/offline-socket-io/',
})

app.createService('stable', {
   sync: async (request, list) => {
      const stables = await prisma.stable.findMany(request)
      const toAdd = []
      const toUpdate = []
      const toDelete = []
      
      return { request, stables }
   },
   ...prisma.stable
})
app.createService('horse', prisma.horse)

app.configure(channels)

app.on('connection', (socket) => {
   app.joinChannel('anonymous', socket)
})

const PORT = process.env.PORT || 3000
app.httpServer.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}`))

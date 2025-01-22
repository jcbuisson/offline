import { expressX } from '@jcbuisson/express-x'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const app = expressX({
   WS_TRANSPORT: true,
   WS_PATH: '/offline-socket-io/',
})

app.createService('stable', prisma.stable)
app.createService('horse', prisma.horse)

const PORT = process.env.PORT || 3000
app.httpServer.listen(PORT, () => console.log(`App listening at http://localhost:${PORT}`))

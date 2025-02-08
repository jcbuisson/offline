
import { synchronize } from '#lib/sync.js'

export default function (app) {

   const prisma = app.get('prisma')

   app.createService('stable', {

      sync: async (where, cutoffDate, clientValuesDict) => {
         return await synchronize(prisma.stable, where, cutoffDate, clientValuesDict)
      },

      ...prisma.stable
   })

}

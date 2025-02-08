
import { synchronize } from '#lib/sync.js'

export default function (app) {

   const prisma = app.get('prisma')

   app.createService('horse', {

      sync: async (where, cutoffDate, clientValuesDict) => {
         return await synchronize(prisma.horse, where, cutoffDate, clientValuesDict)
      },

      ...prisma.horse
   })

}

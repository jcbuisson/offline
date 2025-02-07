
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('horse', {

      time: async () => new Date(),

      // À CHANGER : PLUSIEURS ÉTAPES, LA PREMIÈRE SIMPLE ÉCHANGE DES METADATA SANS LES VALEURS, ENSUITE ÉCHANGE DES VALEURS À AJOUTER/MODIFIER
      sync: async (request, clientTime, offlineDate, clientValuesDict) => {
         console.log('clientValuesDict', clientValuesDict)
         const cutoffDate = offlineDate // || clientTime

         const databaseValues = await prisma.horse.findMany(request)
         const databaseValuesDict = databaseValues.reduce((accu, value) => {
            accu[value.uid] = value
            return accu
         }, {})
         console.log('databaseValuesDict', databaseValuesDict)

         // STEP 1: compute intersections between client and database uids
         const onlyDatabaseIds = new Set()
         const onlyClientIds = new Set()
         const databaseAndClientIds = new Set()

         for (const uid in databaseValuesDict) {
            if (uid in clientValuesDict) {
               databaseAndClientIds.add(uid)
            } else {
               onlyDatabaseIds.add(uid)
            }
         }

         for (const uid in clientValuesDict) {
            if (uid in databaseValuesDict) {
               databaseAndClientIds.add(uid)
            } else {
               onlyClientIds.add(uid)
            }
         }
         console.log('onlyDatabaseIds', onlyDatabaseIds)
         console.log('onlyClientIds', onlyClientIds)
         console.log('databaseAndClientIds', databaseAndClientIds)

         // STEP 2: build add/update/delete sets
         const addDatabase = []
         const updateDatabase = []
         const deleteDatabase = []

         const addClient = []
         const updateClient = []
         const deleteClient = []

         for (const uid of onlyDatabaseIds) {
            const databaseValue = databaseValuesDict[uid]
            addClient.push(databaseValue)
         }

         for (const uid of onlyClientIds) {
            const clientValue = clientValuesDict[uid]
            if (clientValue.deleted_) continue
            if (new Date(clientValue.createdAt) > cutoffDate) {
               addDatabase.push(clientValue)
            } else {
               deleteClient.push(uid)
            }
         }

         for (const uid of databaseAndClientIds) {
            const databaseValue = databaseValuesDict[uid]
            const clientValue = clientValuesDict[uid]
            if (clientValue.deleted_) {
               deleteDatabase.push(uid)
            } else {
               const dateDifference = new Date(clientValue.updatedAt) - databaseValue.updatedAt
               if (dateDifference > 0) {
                  updateDatabase.push(clientValue)
               } else if (dateDifference < 0) {
                  updateClient.push(databaseValue)
               }
            }
         }
         console.log('addDatabase', addDatabase)
         console.log('deleteDatabase', deleteDatabase)
         console.log('updateDatabase', updateDatabase)

         console.log('addClient', addClient)
         console.log('deleteClient', deleteClient)
         console.log('updateClient', updateClient)

         // STEP3: execute database necessary changes
         for (const data of addDatabase) {
            await prisma.horse.create({ data })
         }
         for (const data of updateDatabase) {
            await prisma.horse.update({
               where: { uid: data.uid },
               data: { name: data.name }
            })
         }
         for (const uid of deleteDatabase) {
            await prisma.horse.delete({ where: { uid } })
         }

         // STEP4: return client changes to execute
         return {
            request,
            syncDate: clientTime,
            toAdd: addClient,
            toUpdate: updateClient,
            toDelete: deleteClient,
         }
      },

      ...prisma.horse
   })

}

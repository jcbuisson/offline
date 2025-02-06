
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('stable', {

      time: async () => new Date(),

      // TO CHANGE: WE ONLY NEED CLIENT VALUES METATDATA. NECESSITATE A FURTHER STEP FOR VALUES TO UPDATE?
      sync: async (request, clientTime, offlineDate, clientValuesDict) => {
         console.log('clientValuesDict', clientValuesDict)
         const cutoffDate = offlineDate // || clientTime

         const databaseValues = await prisma.stable.findMany(request)
         const databaseValuesDict = databaseValues.reduce((accu, value) => {
            accu[value.uid] = value
            return accu
         }, {})
         console.log('databaseValuesDict', databaseValuesDict)

         // STEP 1: compute intersections betwen client and database uids
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
            if (clientValue._deleted) {
               deleteDatabase.push(clientValue)
            } else if (new Date(clientValue.createdAt) > cutoffDate) {
               addDatabase.push(clientValue)
            } else {
               deleteClient.push(clientValue)
            }
         }

         for (const uid of databaseAndClientIds) {
            const databaseValue = databaseValuesDict[uid]
            const clientValue = clientValuesDict[uid]
            const dateDifference = new Date(clientValue.updatedAt) - databaseValue.updatedAt
            if (dateDifference > 0) {
               updateDatabase.push(clientValue)
            } else if (dateDifference < 0) {
               updateClient.push(databaseValue)
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
            await prisma.stable.create({ data })
         }
         for (const data of updateDatabase) {
            await prisma.stable.update({
               where: { uid: data.uid },
               data: { name: data.name }
            })
         }
         for (const data of deleteDatabase) {
            await prisma.stable.delete({ where: { uid: data.uid } })
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

      ...prisma.stable
   })

}

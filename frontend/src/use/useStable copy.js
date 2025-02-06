import { computed } from 'vue'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { v4 as uuidv4 } from 'uuid'

import { app, onlineDate, offlineDate } from '/src/client-app.js'
import { getTime } from '/src/use/useTime.js'



/////////////          CACHE BACKED BY INDEXEDB          /////////////

const initialState = () => ({
   requestSyncDate: {},
   requestOngoingDate: {},
   cache: {},
})

export const idb = useIDBKeyval('stable-state', initialState(), { mergeDefaults: true })

export const resetUseStable = () => {
   idb.data.value = initialState()
}


/////////////          PUB / SUB          /////////////

app.service('stable').on('create', stable => {
   console.log('STABLE EVENT created', stable)
   idb.data.value.cache[stable.id] = stable
})

app.service('stable').on('update', stable => {
   console.log('STABLE EVENT update', stable)
   idb.data.value.cache[stable.id] = stable
})

app.service('stable').on('delete', stable => {
   console.log('STABLE EVENT delete', stable)
   delete idb.data.value.cache[stable.id]
})

// app.service('stable').on('sync', ({ request, syncDate, toAdd, toUpdate, toDelete }) => {
//    console.log('STABLE EVENT sync', request, syncDate, toAdd, toUpdate, toDelete)
//    console.log(syncDate, toAdd, toUpdate, toDelete)
//    const requestKey = JSON.stringify(request)
//    idb.data.value.requestOngoingDate[requestKey] = null
//    idb.data.value.requestSyncDate[requestKey] = syncDate
//    for (const value of toAdd) {
//       idb.data.value.cache[value.id] = value
//    }
// })


/////////////          METHODS & COMPUTED          /////////////

export const stableListX = computed(() => {
   if (!idb.data.value) return { synced: false, values: [] }

   const request = { where: {}}
   const requestPredicate = (stable) => true
   const requestKey = JSON.stringify(request)

   const syncDate = idb.data.value.requestSyncDate[requestKey]
   console.log('syncDate', syncDate, 'onlineDate', onlineDate.value, syncDate >= onlineDate.value)
   const values = Object.values(idb.data.value.cache).filter(value => !value._deleted)

   // a sync has been done after online date: data is up to date
   if (syncDate && onlineDate.value && syncDate >= onlineDate.value) {
      return { synced: true, values }
   }

   // a sync must be done
   if (!idb.data.value.requestOngoingDate[requestKey]) {
      const now = getTime()
      idb.data.value.requestOngoingDate[requestKey] = now
      // collect selected local data
      const clientValuesDict = Object.entries(idb.data.value.cache).reduce((accu, [id, value]) => {
         if (requestPredicate(value)) accu[id] = value
         return accu
      }, {})

      // send local data to server and ask for local changes to be made (add, update, delete) to be in sync
      app.service('stable').sync(request, now, offlineDate.value, clientValuesDict)
      .then(({ request, syncDate, toAdd, toUpdate, toDelete }) => {
         console.log(syncDate, toAdd, toUpdate, toDelete)
         const requestKey = JSON.stringify(request)
         idb.data.value.requestOngoingDate[requestKey] = null
         idb.data.value.requestSyncDate[requestKey] = new Date() // syncDate
         // update cache according to server sync directives
         // 1- add missing elements
         for (const value of toAdd) {
            idb.data.value.cache[value.id] = value
         }
         // 2- delete removed elements
         for (const value of toDelete) {
            delete idb.data.value.cache[value.id]
         }
         // 3- update elements
         for (const value of toUpdate) {
            idb.data.value.cache[value.id] = value
         }
      })
   }
   return { synced: false, values }
})


export const stableFromId = computed(() => (id) => idb.data.value.cache[id])

export async function addStable(data) {
   const uuid = uuidv4()
   console.log('create stable', uuid)
   // optimistic update
   const now = new Date()
   idb.data.value.cache[uuid] = { id: uuid, createdAt: now, updatedAt: now, ...data }
   // perform request on backend if connection is active
   const stable = await app.service('stable', { volatile: true }).create({ data: { id: uuid, ...data } })
   idb.data.value.cache[stable.id] = stable
}

export async function patchStable(id, data) {
   // optimistic update
   Object.assign(idb.data.value.cache[id], data)
   // perform request on backend
   await app.service('stable', { volatile: true }).update({ where: { id }, data})
}

export async function deleteStable(id) {
   // optimistic update
   idb.data.value.cache[id]._deleted = true // mark it deleted (for sync)
   // perform request on backend
   await app.service('stable', { volatile: true }).delete({ where: { id }})
}


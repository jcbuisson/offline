import { computed } from 'vue'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { v4 as uuidv4 } from 'uuid'

import { app, onlineDate, offlineDate } from '/src/client-app.js'


/////////////          CACHE BACKED BY INDEXEDB          /////////////

const initialState = () => ({
   requestSyncDate: {},
   requestOngoingDate: {},
   cache: {},
})

const { data: storage } = useIDBKeyval('stable-state', initialState(), { mergeDefaults: true })

export const resetUseStable = () => {
   storage.value = initialState()
}


/////////////          PUB / SUB          /////////////

app.service('stable').on('create', stable => {
   console.log('STABLE EVENT created', stable)
   storage.value.cache[stable.id] = stable
})

app.service('stable').on('update', stable => {
   console.log('STABLE EVENT update', stable)
   storage.value.cache[stable.id] = stable
})

app.service('stable').on('delete', stable => {
   console.log('STABLE EVENT delete', stable)
   delete storage.value.cache[stable.id]
})

// app.service('stable').on('sync', ({ request, syncDate, toAdd, toUpdate, toDelete }) => {
//    console.log('STABLE EVENT sync', request, syncDate, toAdd, toUpdate, toDelete)
//    console.log(syncDate, toAdd, toUpdate, toDelete)
//    const requestKey = JSON.stringify(request)
//    storage.value.requestOngoingDate[requestKey] = null
//    storage.value.requestSyncDate[requestKey] = syncDate
//    for (const value of toAdd) {
//       storage.value.cache[value.id] = value
//    }
// })


/////////////          METHODS & COMPUTED          /////////////

export const stableListX = computed(() => {
   if (!storage.value) return []
   if (!onlineDate.value) return []
   const now = new Date()
   const request = { where: {}}
   const requestPredicate = (stable) => true
   const requestKey = JSON.stringify(request)
   const syncDate = storage.value.requestSyncDate[requestKey]
   console.log('syncDate', syncDate, 'onlineDate', onlineDate.value, syncDate >= onlineDate.value)
   if (syncDate && syncDate >= onlineDate.value) {
      return Object.values(storage.value.cache).filter(value => !value._deleted)
   }
   if (!storage.value.requestOngoingDate[requestKey]) {
      storage.value.requestOngoingDate[requestKey] = now
      const clientValuesDict = Object.entries(storage.value.cache).reduce((accu, [id, value]) => {
         if (requestPredicate(value)) accu[id] = value
         return accu
      }, {})

      app.service('stable').sync(request, now, offlineDate.value, clientValuesDict)
      .then(({ request, syncDate, toAdd, toUpdate, toDelete }) => {
         console.log(syncDate, toAdd, toUpdate, toDelete)
         const requestKey = JSON.stringify(request)
         storage.value.requestOngoingDate[requestKey] = null
         storage.value.requestSyncDate[requestKey] = new Date() // syncDate
         for (const value of toAdd) {
            storage.value.cache[value.id] = value
         }
      })
   }
   return []
})


export const stableFromId = computed(() => (id) => storage.value.cache[id])

export async function addStable(data) {
   const uuid = uuidv4()
   console.log('create stable', uuid)
   // optimistic update
   const now = new Date()
   storage.value.cache[uuid] = { id: uuid, createdAt: now, updatedAt: now, ...data }
   // perform request on backend if connection is active
   const stable = await app.service('stable', { volatile: true }).create({ data: { id: uuid, ...data } })
   storage.value.cache[stable.id] = stable
}

export async function patchStable(id, data) {
   // optimistic update
   Object.assign(storage.value.cache[id], data)
   // perform request on backend
   await app.service('stable', { volatile: true }).update({ where: { id }, data})
}

export async function deleteStable(id) {
   // optimistic update
   storage.value.cache[id]._deleted = true // mark it deleted in case of sync
   // perform request on backend
   await app.service('stable', { volatile: true }).delete({ where: { id }})
}


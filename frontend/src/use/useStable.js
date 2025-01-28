import { computed } from 'vue'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { v4 as uuidv4 } from 'uuid'

import { app, onlineDate } from '/src/client-app.js'


/////////////          CACHE BACKED BY INDEXEDB          /////////////

const initialState = () => ({
   requestSyncDate: {},
   requestOngoingDate: {},
   cache: {},
})

const { data: stableData } = useIDBKeyval('stable-state', initialState(), { mergeDefaults: true })

export const resetUseStable = () => {
   stableData.value = initialState()
}


/////////////          PUB / SUB          /////////////

app.service('stable').on('create', stable => {
   console.log('STABLE EVENT created', stable)
   stableData.value.cache[stable.id] = stable
})

app.service('stable').on('update', stable => {
   console.log('STABLE EVENT update', stable)
   stableData.value.cache[stable.id] = stable
})

app.service('stable').on('delete', stable => {
   console.log('STABLE EVENT delete', stable)
   delete stableData.value.cache[stable.id]
})

app.service('stable').on('sync', ({ request, stables }) => {
   console.log('STABLE EVENT sync', request, stables)
   const requestKey = JSON.stringify(request)
   stableData.value.requestOngoingDate[requestKey] = null
   stableData.value.requestSyncDate[requestKey] = new Date()
   for (const stable of stables) {
      stableData.value.cache[stable.id] = stable
   }
})


/////////////          METHODS & COMPUTED          /////////////

export const stableListX = computed(() => {
   if (!stableData.value) return []
   if (!onlineDate.value) return []
   const request = { where: {}}
   const requestPredicate = (stable) => true
   const requestKey = JSON.stringify(request)
   const syncDate = stableData.value.requestSyncDate[requestKey]
   if (syncDate && syncDate > onlineDate.value) {
      return Object.values(stableData.value.cache)
   }
   if (!stableData.value.requestOngoingDate[requestKey]) {
      stableData.value.requestOngoingDate[requestKey] = new Date()
      const list = Object.entries(stableData.value.cache).reduce((accu, [id, value]) => {
         return requestPredicate(value) ? accu.concat({ id, createdAt: value.createdAt, updatedAt: value.updatedAt }) : accu
      }, [])
      app.service('stable').sync(request, list)
   }
   return []
})


export const stableFromId = computed(() => (id) => stableData.value.cache[id])

export async function addStable(data) {
   const uuid = uuidv4()
   console.log('create stable', uuid)
   // optimistic update
   const now = new Date()
   stableData.value.cache[uuid] = { id: uuid, createdAt: now, updatedAt: now, ...data }
   // perform request on backend if connection is active
   const stable = await app.service('stable', { volatile: true }).create({ data: { id: uuid, ...data } })
   stableData.value.cache[stable.id] = stable
}

export async function patchStable(id, data) {
   // optimistic update
   Object.assign(stableData.value.cache[id], data)
   // perform request on backend
   await app.service('stable', { volatile: true }).update({ where: { id }, data})
}

export async function deleteStable(id) {
   // optimistic update
   delete stableData.value.cache[id]
   // perform request on backend
   await app.service('stable', { volatile: true }).delete({ where: { id }})
}


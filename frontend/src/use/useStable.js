import { computed } from 'vue'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { v4 as uuidv4 } from 'uuid'

import { app, onlineDate } from '/src/client-app.js'


/////////////          CACHE BACKED BY INDEXEDB          /////////////

const initialState = () => ({
   cache: {},
   stableStatus: {},
   stableListStatus: {},

   requestSyncDate: {},
   requestOngoing: {},
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
   stableData.value.requestOngoing[requestKey] = false
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
   const requestKey = JSON.stringify(request)
   const syncDate = stableData.value.requestSyncDate[requestKey]
   if (syncDate && syncDate > onlineDate.value) {
      return Object.values(stableData.value.cache)
   }
   if (!stableData.value.requestOngoing[requestKey]) {
      stableData.value.requestOngoing[requestKey] = true
      const list = Object.entries(stableData.value.cache).reduce((accu, [id, value]) => {
         return accu.concat({ id, createdAt: value.createdAt, updatedAt: value.updatedAt })
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
   data.id = uuid
   stableData.value.cache[uuid] = data
   // perform request on backend
   const stable = await app.service('stable').create({ data })
   stableData.value.cache[stable.id] = stable
}

export async function patchStable(id, data) {
   // optimistic update
   Object.assign(stableData.value.cache[id], data)
   // perform request on backend
   await app.service('stable').update({ where: { id }, data})
}

export async function deleteStable(id) {
   // optimistic update
   delete stableData.value.cache[id]
   // perform request on backend
   await app.service('stable').delete({ where: { id }})
}


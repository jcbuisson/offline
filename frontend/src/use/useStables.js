import { computed } from 'vue'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { v4 as uuidv4 } from 'uuid'

import { app } from '/src/client-app.js'


/////////////          CACHE BACKED BY INDEXEDB          /////////////

const initialState = () => ({
   stableCache: {},
})

const { data: stableData } = useIDBKeyval('stable-state', initialState(), { mergeDefaults: true })


/////////////          PUB / SUB          /////////////

app.service('stable').on('create', stable => {
   console.log('STABLE EVENT created', stable)
   stableData.value.stableCache[stable.id] = stable
})

app.service('stable').on('update', stable => {
   console.log('STABLE EVENT update', stable)
   stableData.value.stableCache[stable.id] = stable
})

app.service('stable').on('delete', stable => {
   console.log('STABLE EVENT delete', stable)
   delete stableData.value.stableCache[stable.id]
})


/////////////          METHODS & COMPUTED          /////////////

export async function fetchStables() {
   const stableList = await app.service('stable').findMany({})
   for (const stable of stableList) {
      stableData.value.stableCache[stable.id] = stable
   }
   stableData.value.dummykey = { a: 123 }
   return stableList
}

export const stableList = computed(() => {
   return Object.values(stableData.value.stableCache)
})

export const stableFromId = computed(() => (id) => stableData.value.stableCache[id])

// export async function getStable(id) {
//    return stableData?.value.stableCache[id]
// }

export async function addStable(data) {
   data.id = uuidv4()
   // optimistic update
   Object.assign(stableData.value.stableCache[data.id], data)
   // perform request on backend
   const stable = await app.service('stable').create({ data })
   console.log('stable', stable)
   stableData.value.stableCache[stable.id] = stable
}

export async function patchStable(id, data) {
   // optimistic update
   Object.assign(stableData.value.stableCache[id], data)
   // perform request on backend
   await app.service('stable').update({ where: { id }, data})
}

export async function deleteStable(id) {
   // optimistic update
   delete stableData.value.stableCache[id]
   // perform request on backend
   await app.service('stable').delete({ where: { id }})
}


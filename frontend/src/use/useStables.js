import { ref, computed } from 'vue'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'

import { app } from '/src/client-app.js'


const initialState = () => ({
   stableCache: {},
})

/////////////          CACHE BACKED BY INDEXEDB          /////////////
const { data: stableData } = useIDBKeyval('stable-state', initialState(), { mergeDefaults: true })


/////////////          METHODS & COMPUTED          /////////////
export async function fetchStables() {
   const stableList = await app.service('stable').findMany({})
   for (const stable of stableList) {
      stableData.value.stableCache[stable.id] = stable
   }
   stableData.value.dummykey = { a: 123 }
   return stableList
}

export const id2stable = computed(() => stableData.value.id2stable)

export const stableList = computed(() => {
   return Object.values(stableData.value.stableCache)
})

export const stableFromId = computed(() => (id) => stableData.value.stableCache[id])

// export async function getStable(id) {
//    return stableData?.value.stableCache[id]
// }

export async function addStable(data) {
   const stable = await app.service('stable').create({ data })
   stableData.value.stableCache[stable.id] = stable
}

export async function patchStable(id, data) {
   const stable = await app.service('stable').update({ where: { id }, data})
   stableData.value.stableCache[stable.id] = stable
   return stable
}

export async function deleteStable(id) {
   await app.service('stable').delete({ where: { id }})
   delete data.value.stableCache[id]
}


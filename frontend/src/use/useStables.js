import { ref, computed } from 'vue'

import { app } from '/src/client-app.js'


/////////////          CACHES          /////////////
export const id2stable = ref({})


/////////////          METHODS & COMPUTED          /////////////
export async function fetchStables() {
   const stableList = await app.service('stable').findMany({})
   for (const stable of stableList) {
      id2stable.value[stable.id] = stable
   }
   return stableList
}

export const stableList = computed(() => Object.values(id2stable.value))

export const stableFromId = computed(() => (id) => id2stable.value[id])

export async function getStable(id) {
   return id2stable.value[id]
}

export async function addStable(data) {
   const stable = await app.service('stable').create({ data })
   id2stable.value[stable.id] = stable
}

export async function deleteStable(id) {
   await app.service('stable').delete({ where: { id }})
   delete id2stable.value[id]
}


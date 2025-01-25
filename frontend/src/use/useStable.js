import { computed } from 'vue'
import { useIDBKeyval } from '@vueuse/integrations/useIDBKeyval'
import { v4 as uuidv4 } from 'uuid'

import { app } from '/src/client-app.js'


/////////////          CACHE BACKED BY INDEXEDB          /////////////

const initialState = () => ({
   stableCache: {},
   stableStatus: {},
   stableListStatus: {},
})

const { data: stableData } = useIDBKeyval('stable-state', initialState(), { mergeDefaults: true })
const { data: onOffData } = useIDBKeyval('on-off', {
   on: 0,
   off: 0,
   beforeunload: 0,
   load: 0,
   unload: 0,
   visibilitychange: 0,
   pagehide: 0,
   pageshow: 0,
}, { mergeDefaults: true })

export const resetUseStable = () => {
   stableData.value = initialState()
}

window.addEventListener('online', async () => {
   onOffData.value.on += 1
   resetUseStable()
})

window.addEventListener('offline', () => {
   onOffData.value.off += 1
})

window.addEventListener('beforeunload', (event) => {
   console.log('User is about to leave the page.');
   event.preventDefault();
   event.returnValue = ''; // Shows the confirmation dialog in some browsers
   onOffData.value.beforeunload += 1
});
 
window.addEventListener('load', () => {
   console.log('Page is being loaded.');
   onOffData.value.load += 1
});
 
window.addEventListener('unload', () => {
   console.log('Page is being unloaded.');
   navigator.sendBeacon('/log', JSON.stringify({ action: 'page_unload' }));
   onOffData.value.unload += 1
});
 
 document.addEventListener('visibilitychange', () => {
   if (document.visibilityState === 'hidden') {
     console.log('Page is hidden. Pausing tasks...');
   } else if (document.visibilityState === 'visible') {
     console.log('Page is visible. Resuming tasks...');
   }
   onOffData.value.visibilitychange += 1
});
 
 window.addEventListener('pagehide', () => {
   console.log('Page is being hidden.');
   onOffData.value.pagehide += 1
});
 
 window.addEventListener('pageshow', (event) => {
   if (event.persisted) {
     console.log('Page restored from cache.');
   }
   console.log('Page is visible again.');
   onOffData.value.pageshow += 1
});
 
export const onCount = computed(() => onOffData.value.on)
export const offCount = computed(() => onOffData.value.off)
export const beforeunloadCount = computed(() => onOffData.value.beforeunload)
export const loadCount = computed(() => onOffData.value.load)
export const unloadCount = computed(() => onOffData.value.unload)
export const visibilitychangeCount = computed(() => onOffData.value.visibilitychange)
export const pagehideCount = computed(() => onOffData.value.pagehide)
export const pageshowCount = computed(() => onOffData.value.pageshow)


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

export const stableList = computed(() => {
   if (!stableData.value) return []
   if (stableData.value.stableListStatus === 'ready') {
      return Object.values(stableData.value.stableCache)
   }
   if (stableData.value.stableListStatus !== 'ongoing') {
      stableData.value.stableListStatus = 'ongoing'
      app.service('stable').findMany({})
      .then(list => {
         for (const elt of list) {
            stableData.value.stableCache[elt.id] = elt
            stableData.value.stableStatus[elt.id] = 'ready'
         }
         stableData.value.stableListStatus = 'ready'
      }).catch(err => {
         console.log('stableList err', err)
         delete stableData.value.stableListStatus
      })
   }
   return []
})

export const stableFromId = computed(() => (id) => stableData.value.stableCache[id])

export async function addStable(data) {
   const uuid = uuidv4()
   console.log('create stable', uuid)
   // optimistic update
   data.id = uuid
   stableData.value.stableCache[uuid] = data
   // perform request on backend
   const stable = await app.service('stable').create({ data })
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


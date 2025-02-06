import { ref, computed, toRaw } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Dexie from "dexie"
import { liveQuery } from "dexie"
import { useObservable } from "@vueuse/rxjs"

import { app, onlineDate, offlineDate } from '/src/client-app.js'
import { getTime } from '/src/use/useTime.js'




const db = new Dexie("stablesDatabase")

db.version(1).stores({
   requestSyncDate: "requestKey, date",
   requestOngoingDate: "requestKey, date",
   stables: "uid, createdAt, updatedAt, name, deleted_"
})

// const stables = ref({})

// // Automatically update users when IndexedDB changes
// liveQuery(() => db.stables.toArray()).subscribe((stableList) => {
//    console.log('liveQuery')
//    for (const stable of stableList) {
//       stables.value[stable.uid] = stable
//    }
// })



export const resetUseStable = () => {
   // ??
}


/////////////          PUB / SUB          /////////////

app.service('stable').on('create', async stable => {
   console.log('STABLE EVENT created', stable)
   await db.stables.put(stable)
})

app.service('stable').on('update', async stable => {
   console.log('STABLE EVENT update', stable)
   await db.stables.put(stable)
})

app.service('stable').on('delete', async stable => {
   console.log('STABLE EVENT delete', stable)
   await db.stables.delete(stable.uid)
})

// app.service('stable').on('sync', ({ request, syncDate, toAdd, toUpdate, toDelete }) => {
//    console.log('STABLE EVENT sync', request, syncDate, toAdd, toUpdate, toDelete)
//    console.log(syncDate, toAdd, toUpdate, toDelete)
//    const requestKey = JSON.stringify(request)
//    idb.data.value.requestOngoingDate[requestKey] = null
//    idb.data.value.requestSyncDate[requestKey] = syncDate
//    for (const value of toAdd) {
//       idb.data.value.cache[value.uid] = value
//    }
// })


/////////////          METHODS & COMPUTED          /////////////

export async function getStable(uid) {
   return db.stables.get(uid)
}

export const stableList = useObservable(
   liveQuery(() => {
      console.log('liveQuery list')
      const promise = db.stables.filter(stable => !stable.deleted_).toArray()
      return promise
   })
)

app.addConnectListener(async (socket) => {
   console.log('online! synchronizing...')
   await synchronize()
})
app.addDisconnectListener(async (socket) => {
   console.log('offline!')
})


export async function synchronize() {
   const request = { where: {}}
   const requestPredicate = (stable) => true
   const requestKey = JSON.stringify(request)

   const allValues = await db.stables.toArray()
   const clientValuesDict = allValues.reduce((accu, elt) => {
      if (requestPredicate(elt)) accu[elt.uid] = elt
      return accu
   }, {})

   // send local data to server and ask for local changes to be made (add, update, delete) to be in sync
   const now = new Date()
   const { syncDate, toAdd, toUpdate, toDelete } = await app.service('stable').sync(request, now, offlineDate.value, clientValuesDict)
   console.log(syncDate, toAdd, toUpdate, toDelete)
   await db.requestOngoingDate.put({ requestKey, date: null })
   await db.requestSyncDate.put({ requestKey, date: new Date() })
   // update cache according to server sync directives
   // 1- add missing elements
   for (const stable of toAdd) {
      await db.stables.add(stable)
   }
   // 2- delete removed elements
   for (const uid of toDelete) {
      await db.stables.delete(uid)
   }
   // 3- update elements
   for (const stable of toUpdate) {
      await db.stables.update(stable.uid, stable)
   }
}

// export const stableListX = computed(() => {
//    // if (!idb.data.value) return { synced: false, values: [] }

//    const request = { where: {}}
//    const requestPredicate = (stable) => true
//    const requestKey = JSON.stringify(request)

//    const syncDate = db.requestOngoingDate.get(requestKey)
//    console.log('syncDate', syncDate, 'onlineDate', onlineDate.value, syncDate >= onlineDate.value)
//    const values = Object.values(idb.data.value.cache).filter(value => !value._deleted)

//    // a sync has been done after online date: data is up to date
//    if (syncDate && onlineDate.value && syncDate >= onlineDate.value) {
//       return { synced: true, values }
//    }

//    // a sync must be done
//    if (!idb.data.value.requestOngoingDate[requestKey]) {
//       const now = getTime()
//       idb.data.value.requestOngoingDate[requestKey] = now
//       // collect selected local data
//       const clientValuesDict = db.stables.toArray().reduce((accu, [uid, value]) => {
//          if (requestPredicate(value)) accu[uid] = value
//          return accu
//       }, {})

//       // send local data to server and ask for local changes to be made (add, update, delete) to be in sync
//       app.service('stable').sync(request, now, offlineDate.value, clientValuesDict)
//       .then(({ request, syncDate, toAdd, toUpdate, toDelete }) => {
//          console.log(syncDate, toAdd, toUpdate, toDelete)
//          const requestKey = JSON.stringify(request)
//          db.requestOngoingDate.put({ requestKey, date: null })
//          db.requestSyncDate.put({ requestKey, date: new Date() })
//          // update cache according to server sync directives
//          // 1- add missing elements
//          for (const stable of toAdd) {
//             db.stables.put(stable)
//          }
//          // 2- delete removed elements
//          for (const stable of toDelete) {
//             db.stables.delete(stable.uid)
//          }
//          // 3- update elements
//          for (const stable of toUpdate) {
//             db.stables.put(stable)
//          }
//       })
//    }
//    return { synced: false, values }
// })


// export const stableFromId = computed(() => (uid) => db.stables.get(uid))

export async function addStable(data) {
   const uuid = uuidv4()
   console.log('create stable', uuid)
   // optimistic update
   const now = new Date()
   await db.stables.add({ uid: uuid, createdAt: now, updatedAt: now, ...data })
   // perform request on backend (if connection is active)
   await app.service('stable', { volatile: true }).create({ data: { uid: uuid, ...data } })
}

export async function patchStable(uid, data) {
   // optimistic update
   await db.stables.update(uid, { name: data.name, updatedAt: new Date() })
   // perform request on backend (if connection is active)
   await app.service('stable', { volatile: true }).update({ where: { uid }, data})
}

export async function deleteStable(uid) {
   // optimistic update
   await db.stables.update(uid, { deleted_: true })
   // perform request on backend (if connection is active)
   await app.service('stable', { volatile: true }).delete({ where: { uid }})
}

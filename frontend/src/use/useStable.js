import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Dexie from "dexie"
import { liveQuery } from "dexie"
import { useObservable } from "@vueuse/rxjs"

import { app, offlineDate } from '/src/client-app.js'
import { synchronize, handleWhere, synchronizeAll } from '/src/lib/sync.js'

import { db as horseDB } from '/src/use/useHorse.js'


const db = new Dexie("stablesDatabase")

db.version(1).stores({
   whereList: "id",
   stables: "uid, createdAt, updatedAt, name, deleted_"
})


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


/////////////          METHODS          /////////////

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
   await horseDB.horses.where("stable_uid").equals(uid).modify({ deleted_: true }) // delete on cascade
   // perform request on backend (if connection is active)
   await app.service('stable', { volatile: true }).delete({ where: { uid }})
}


/////////////          SYNCHRONIZATION          /////////////

export async function addStableSynchro(where) {
   if (handleWhere(where, db.whereList)) {
      await synchronize(app.service('stable'), db.stables, where, offlineDate.value)
   }
}

app.addConnectListener(async (socket) => {
   console.log('online! synchronizing...')
   await synchronizeAll(app.service('stable'), db.stables, offlineDate.value, db.whereList)
})

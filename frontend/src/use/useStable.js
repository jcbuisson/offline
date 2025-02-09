import { ref, computed, toRaw } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Dexie from "dexie"
import { liveQuery } from "dexie"
import { useObservable } from "@vueuse/rxjs"

import { app, offlineDate } from '/src/client-app.js'
import { synchronize } from '/src/lib/sync.js'


const db = new Dexie("stablesDatabase")

db.version(1).stores({
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
   // perform request on backend (if connection is active)
   await app.service('stable', { volatile: true }).delete({ where: { uid }})
}


/////////////          SYNCHRONIZATION          /////////////

app.addConnectListener(async (socket) => {
   console.log('online! synchronizing...')
   const where = {}
   await synchronize(app.service('stable'), db.stables, where, offlineDate.value)
})

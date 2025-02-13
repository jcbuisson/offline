import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Dexie from "dexie"
import { liveQuery } from "dexie"
import { useObservable } from "@vueuse/rxjs"

import { app, offlineDate } from '/src/client-app.js'
import { synchronize, handleWhere, synchronizeAll } from '/src/lib/sync.js'


export const db = new Dexie("horseDatabase")

db.version(1).stores({
   whereList: "id",
   horses: "uid, createdAt, updatedAt, deleted_, name, stable_uid"
})



/////////////          PUB / SUB          /////////////

app.service('horse').on('create', async horse => {
   console.log('HORSE EVENT created', horse)
   await db.horses.put(horse)
})

app.service('horse').on('update', async horse => {
   console.log('HORSE EVENT update', horse)
   await db.horses.put(horse)
})

app.service('horse').on('delete', async horse => {
   console.log('HORSE EVENT delete', horse)
   await db.horses.delete(horse.uid)
})


/////////////          METHODS          /////////////

export async function getHorse(horse_uid) {
   return db.horses.get(horse_uid)
}

export const horseList = useObservable(
   liveQuery(() => {
      const promise = db.horses.filter(horse => !horse.deleted_).toArray()
      return promise
   })
)

export function getStableHorses(stable_uid) {
   return db.horses.filter(horse => !horse.deleted_ && horse.stable_uid === stable_uid).toArray()
}

export const horsesOfStable = computed(() => (stable_id) => useObservable(
   liveQuery(() => {
      return db.horses.filter(horse => !horse.deleted_ && horse.stable_id === stable_id).toArray()
   })
))

export async function addHorse(stable_uid, data) {
   const uid = uuidv4()
   // optimistic update
   const now = new Date()
   await db.horses.add({ uid, createdAt: now, updatedAt: now, stable_uid, ...data })
   // perform request on backend (if connection is active)
   await app.service('horse', { volatile: true }).create({ data: { uid, stable_uid, ...data } })
}

export async function patchHorse(uid, data) {
   // optimistic update
   await db.horses.update(uid, { name: data.name, updatedAt: new Date() })
   // perform request on backend (if connection is active)
   await app.service('horse', { volatile: true }).update({ where: { uid }, data})
}

export async function deleteHorse(uid) {
   // optimistic update
   await db.horses.update(uid, { deleted_: true })
   // perform request on backend (if connection is active)
   await app.service('horse', { volatile: true }).delete({ where: { uid }})
}


/////////////          SYNCHRONIZATION          /////////////

export async function addHorseSynchro(where) {
   if (handleWhere(where, db.whereList)) {
      await synchronize(app.service('horse'), db.horses, where, offlineDate.value)
   }
}

app.addConnectListener(async (socket) => {
   console.log('websocket reconnection: synchronizing...')
   await synchronizeAll(app.service('horse'), db.horses, offlineDate.value, db.whereList)
})

import { ref, computed, toRaw } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Dexie from "dexie"
import { liveQuery } from "dexie"
import { useObservable } from "@vueuse/rxjs"

import { app, offlineDate } from '/src/client-app.js'


const db = new Dexie("horseDatabase")

db.version(1).stores({
   horses: "uid, createdAt, updatedAt, deleted_, name, horse_id"
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


/////////////          METHODS & COMPUTED          /////////////

export async function getHorse(uid) {
   return db.horses.get(uid)
}

export function getHorseList(stable_uid) {
   return db.horses.filter(horse => !horse.deleted_ && horse.stable_uid === stable_uid).toArray()
}

app.addConnectListener(async (socket) => {
   console.log('online! synchronizing...')
   await synchronize()
})


export async function synchronize() {
   const request = { where: {}}
   const requestPredicate = (horse) => true
   const requestKey = JSON.stringify(request)

   const allValues = await db.horses.toArray()
   const clientValuesDict = allValues.reduce((accu, elt) => {
      if (requestPredicate(elt)) accu[elt.uid] = elt
      return accu
   }, {})

   // send local data to server and ask for local changes to be made (add, update, delete) to be in sync
   const now = new Date()
   const { syncDate, toAdd, toUpdate, toDelete } = await app.service('horse').sync(request, now, offlineDate.value, clientValuesDict)
   console.log(syncDate, toAdd, toUpdate, toDelete)
   await db.requestOngoingDate.put({ requestKey, date: null })
   await db.requestSyncDate.put({ requestKey, date: new Date() })
   // update cache according to server sync directives
   // 1- add missing elements
   for (const horse of toAdd) {
      await db.horses.add(horse)
   }
   // 2- delete removed elements
   for (const uid of toDelete) {
      await db.horses.delete(uid)
   }
   // 3- update elements
   for (const horse of toUpdate) {
      await db.horses.update(horse.uid, horse)
   }
}

export async function addHorse(data) {
   const uuid = uuidv4()
   console.log('create horse', uuid)
   // optimistic update
   const now = new Date()
   await db.horses.add({ uid: uuid, createdAt: now, updatedAt: now, ...data })
   // perform request on backend (if connection is active)
   await app.service('horse', { volatile: true }).create({ data: { uid: uuid, ...data } })
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

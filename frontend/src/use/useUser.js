import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Dexie from "dexie"
import { liveQuery } from "dexie"
import { useObservable } from "@vueuse/rxjs"

import { app, offlineDate } from '/src/client-app.js'
import { synchronize, addSynchroWhere, synchronizeAll } from '/src/lib/synchronize.js'

import { db as horseDB } from '/src/use/useHorse.js'


export const db = new Dexie("userDatabase")

db.version(1).stores({
   whereList: "id++",
   values: "uid, createdAt, updatedAt, name, deleted_"
})


/////////////          PUB / SUB          /////////////

app.service('user').on('create', async user => {
   console.log('USER EVENT created', user)
   await db.values.put(user)
})

app.service('user').on('update', async user => {
   console.log('USER EVENT update', user)
   await db.values.put(user)
})

app.service('user').on('delete', async user => {
   console.log('USER EVENT delete', user)
   await db.values.delete(user.uid)
})


/////////////          METHODS          /////////////

export const getUserRef = (uid) => {
   // synchronize on this user
   addSynchroWhere({ uid })
   // return reactive ref
   return useObservable(liveQuery(() => db.values.get(uid)))
}

export const getUserListObservable = () => {
   // synchronize on this perimeter
   addSynchroWhere({}, db.whereList)
   // return reactive ref
   return liveQuery(() => db.values.filter(user => !user.deleted_).toArray())
}

export async function addUser(data) {
   // // synchronize on this perimeter
   // addSynchroWhere({ uid: data.uid }, db.whereList)
   const uuid = uuidv4()
   console.log('create user', uuid)
   // optimistic update
   const now = new Date()
   await db.values.add({ uid: uuid, createdAt: now, updatedAt: now, ...data })
   // perform request on backend (if connection is active)
   await app.service('user', { volatile: true }).create({ data: { uid: uuid, ...data } })
}

export async function patchUser(uid, data) {
   // synchronize on this perimeter
   addSynchroWhere({ uid }, db.whereList)
   // optimistic update
   await db.values.update(uid, { name: data.name, updatedAt: new Date() })
   // perform request on backend (if connection is active)
   await app.service('user', { volatile: true }).update({ where: { uid }, data})
}

export async function deleteUser(uid) {
   // // stop synchronizing on this perimeter
   // removeSynchroWhere({ uid }, db.whereList)
   // optimistic update
   await db.values.update(uid, { deleted_: true })
   await horseDB.horses.where("user_uid").equals(uid).modify({ deleted_: true }) // delete on cascade
   // perform request on backend (if connection is active)
   await app.service('user', { volatile: true }).delete({ where: { uid }})
}


/////////////          SYNCHRONIZATION          /////////////

export async function addUserSynchro(where) {
   if (addSynchroWhere(where, db.whereList)) {
      await synchronize(app, 'user', db.values, where, offlineDate.value)
   }
}

app.addConnectListener(async (socket) => {
   console.log('online! synchronizing...')
   await synchronizeAll(app, 'user', db.values, offlineDate.value, db.whereList)
})

import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Dexie from "dexie"
import { liveQuery } from "dexie"

import { app, offlineDate } from '/src/client-app.js'
import { wherePredicate, synchronize, addSynchroWhere, synchronizeAll } from '/src/lib/synchronize.js'


export const db = new Dexie("groupDatabase")

db.version(1).stores({
   whereList: "id++",
   values: "uid, createdAt, updatedAt, name, deleted_"
})

export const resetUseGroup = async () => {
   await db.values.clear()
   await db.whereList.clear()
}


/////////////          PUB / SUB          /////////////

app.service('group').on('create', async group => {
   console.log('GROUP EVENT created', group)
   await db.values.put(group)
})

app.service('group').on('update', async group => {
   console.log('GROUP EVENT update', group)
   await db.values.put(group)
})

app.service('group').on('delete', async group => {
   console.log('GROUP EVENT delete', group)
   await db.values.delete(group.uid)
})


/////////////          METHODS          /////////////

export const getGroupListObservable = () => {
   // synchronize on this perimeter
   addSynchroWhere({}, db.whereList)
   // return observable
   return liveQuery(() => db.values.filter(group => !group.deleted_).toArray())
}

export async function addGroup(data) {
   // // synchronize on this perimeter
   // addSynchroWhere({ uid: data.uid }, db.whereList)
   const uuid = uuidv4()
   console.log('create group', uuid)
   // optimistic update
   const now = new Date()
   await db.values.add({ uid: uuid, createdAt: now, updatedAt: now, ...data })
   // perform request on backend (if connection is active)
   await app.service('group', { volatile: true }).create({ data: { uid: uuid, ...data } })
}

export async function patchGroup(uid, data) {
   // synchronize on this perimeter
   addSynchroWhere({ uid }, db.whereList)
   // optimistic update
   await db.values.update(uid, { name: data.name, updatedAt: new Date() })
   // perform request on backend (if connection is active)
   await app.service('group', { volatile: true }).update({ where: { uid }, data})
}

export async function deleteGroup(uid) {
   // // stop synchronizing on this perimeter
   // removeSynchroWhere({ uid }, db.whereList)
   // optimistic update
   await db.values.update(uid, { deleted_: true })
   // perform request on backend (if connection is active)
   await app.service('group', { volatile: true }).delete({ where: { uid }})
}


/////////////          SYNCHRONIZATION          /////////////

export async function addGroupSynchro(where) {
   if (addSynchroWhere(where, db.whereList)) {
      await synchronize(app, 'group', db.values, where, offlineDate.value)
   }
   const predicate = wherePredicate(where)
   const values = db.values.filter(value => !value.deleted_ && predicate(value)).toArray()
   return values
}

app.addConnectListener(async (socket) => {
   console.log('online! synchronizing...')
   await synchronizeAll(app, 'group', db.values, offlineDate.value, db.whereList)
})

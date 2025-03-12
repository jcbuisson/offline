import { ref } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Dexie from "dexie"
import { liveQuery } from "dexie"

import { app, offlineDate } from '/src/client-app.js'
import { wherePredicate, synchronize, addSynchroWhere, synchronizeAll } from '/src/lib/synchronize.js'
import { deleteRelation, getRelationListFromUser } from "/src/use/useRelation"


export const db = new Dexie("userDatabase")

db.version(1).stores({
   whereList: "id++",
   values: "uid, createdAt, updatedAt, name, deleted_"
})

export const resetUseUser = async () => {
   await db.values.clear()
   await db.whereList.clear()
}

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

export const getUserListObservable = () => {
   // return observable
   return liveQuery(() => db.values.filter(user => !user.deleted_).toArray())
}

export async function addUser(data) {
   const uid = uuidv4()
   console.log('create user', uid)
   // enlarge perimeter
   addSynchroWhere({ uid }, db.whereList)
   // optimistic update
   const now = new Date()
   await db.values.add({ uid, createdAt: now, updatedAt: now, ...data })
   // perform request on backend (if connection is active)
   await app.service('user', { volatile: true }).create({ data: { uid, ...data } })
}

export async function patchUser(uid, data) {
   // enlarge perimeter (normally useless for patch)
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
   // cascade-delete associated relations
   const relations = await getRelationListFromUser(uid)
   await Promise.all(relations.map(relation => deleteRelation(relation)))
   // delete user
   await db.values.update(uid, { deleted_: true })
   // perform request on backend (if connection is active)
   await app.service('user', { volatile: true }).delete({ where: { uid }})
}


/////////////          SYNCHRONIZATION          /////////////

export async function selectValues(where) {
   if (addSynchroWhere(where, db.whereList)) {
      await synchronize(app, 'user', db.values, where, offlineDate.value)
   }
   const predicate = wherePredicate(where)
   const values = db.values.filter(value => !value.deleted_ && predicate(value)).toArray()
   return values
}

export const getWhereListObservable = () => {
   return liveQuery(() => db.whereList.toArray())
}


export const synchronizePerimeter = async () => {
   await synchronizeAll(app, 'user', db.values, offlineDate.value, db.whereList)
}

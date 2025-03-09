import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Dexie from "dexie"
import { liveQuery } from "dexie"

import { app, offlineDate } from '/src/client-app.js'
import { wherePredicate, synchronize, addSynchroWhere, synchronizeAll } from '/src/lib/synchronize.js'


export const db = new Dexie("relationDatabase")

db.version(1).stores({
   whereList: "id++",
   values: "uid, createdAt, updatedAt, user_uid, group_uid, deleted_"
})

export const resetUseRelation = async () => {
   await db.values.clear()
   await db.whereList.clear()
}


/////////////          PUB / SUB          /////////////

app.service('relation').on('create', async relation => {
   console.log('RELATION EVENT created', relation)
   await db.values.put(relation)
})

app.service('relation').on('update', async relation => {
   console.log('RELATION EVENT update', relation)
   await db.values.put(relation)
})

app.service('relation').on('delete', async relation => {
   console.log('RELATION EVENT delete', relation)
   await db.values.delete(relation.uid)
})


/////////////          METHODS          /////////////

export const getRelationListObservable = () => {
   // synchronize on this perimeter
   addSynchroWhere({}, db.whereList)
   // return observable
   return liveQuery(() => db.values.filter(relation => !relation.deleted_).toArray())
}

export const getRelationListFrom = async (user_id) => {
   return await db.values.filter(relation => !relation.deleted_ && relation.user_id === user_id).toArray()
}

export async function addRelation(data) {
   // // synchronize on this perimeter
   // addSynchroWhere({ uid: data.uid }, db.whereList)
   const uuid = uuidv4()
   console.log('create relation', uuid)
   // optimistic update
   const now = new Date()
   await db.values.add({ uid: uuid, createdAt: now, updatedAt: now, ...data })
   // perform request on backend (if connection is active)
   await app.service('relation', { volatile: true }).create({ data: { uid: uuid, ...data } })
}

export async function patchRelation(uid, data) {
   // synchronize on this perimeter
   addSynchroWhere({ uid }, db.whereList)
   // optimistic update
   await db.values.update(uid, { name: data.name, updatedAt: new Date() })
   // perform request on backend (if connection is active)
   await app.service('relation', { volatile: true }).update({ where: { uid }, data})
}

export async function deleteRelation(uid) {
   // // stop synchronizing on this perimeter
   // removeSynchroWhere({ uid }, db.whereList)
   // optimistic update
   await db.values.update(uid, { deleted_: true })
   // perform request on backend (if connection is active)
   await app.service('relation', { volatile: true }).delete({ where: { uid }})
}


/////////////          SYNCHRONIZATION          /////////////

export async function addRelationSynchro(where) {
   if (addSynchroWhere(where, db.whereList)) {
      await synchronize(app, 'relation', db.values, where, offlineDate.value)
   }
   const predicate = wherePredicate(where)
   const values = db.values.filter(value => !value.deleted_ && predicate(value)).toArray()
   return values
}

app.addConnectListener(async (socket) => {
   console.log('online! synchronizing...')
   await synchronizeAll(app, 'relation', db.values, offlineDate.value, db.whereList)
})

import Dexie from "dexie"
import { liveQuery } from "dexie"
import { uid as uid16 } from 'uid'

import { getMany as getManyUserGroupRelation, remove as removeGroupRelation, removeSynchroWhere as removeSynchroUserGroupRelationWhere } from '/src/use/useUserGroupRelation'
import { wherePredicate, synchronize, addSynchroDBWhere, removeSynchroDBWhere, synchronizeModelWhereList } from '/src/lib/synchronize.js'
import { app, isConnected, disconnectedDate } from '/src/client-app.js'

export const db = new Dexie(import.meta.env.VITE_APP_GROUP_IDB)

db.version(1).stores({
   whereList: "sortedjson, where",
   values: "uid, __deleted__, name",
   metadata: "uid, created_at, updated_at, deleted_at",
})

export const reset = async () => {
   await db.whereList.clear()
   await db.values.clear()
   await db.metadata.clear()
}

/////////////          PUB / SUB          /////////////

app.service('group').on('createWithMeta', async ([value, meta]) => {
   console.log('GROUP EVENT createWithMeta', value)
   await db.values.put(value)
   await db.metadata.put(meta)
})

app.service('group').on('updateWithMeta', async ([value, meta]) => {
   console.log('GROUP EVENT updateWithMeta', value)
   await db.values.put(value)
   await db.metadata.put(meta)
})

app.service('group').on('deleteWithMeta', async ([value, meta]) => {
   console.log('GROUP EVENT deleteWithMeta', value)
   await db.values.delete(value.id)
   await db.metadata.put(meta)
})

/////////////          CACHE METHODS          /////////////

export async function get(uid) {
   return await db.values.get(uid)
}

export async function getMany(where) {
   const predicate = wherePredicate(where)
   return await db.values.filter(value => !value.__deleted__ && predicate(value)).toArray()
}

/////////////          CRUD METHODS WITH SYNC          /////////////

// return an Observable
export async function findMany$(where) {
   const isNew = await addSynchroWhere(where)
   // run synchronization if connected and if `where` is new
   if (isNew && isConnected.value) {
      synchronize(app, 'group', db.values, db.metadata, where, disconnectedDate.value)
   }
   // return observable for `where` values
   const predicate = wherePredicate(where)
   return liveQuery(() => db.values.filter(value => !value.__deleted__ && predicate(value)).toArray())
}

export async function create(data) {
   const uid = uid16(16)
   // enlarge perimeter
   await addSynchroWhere({ uid })
   // optimistic update
   const now = new Date()
   await db.values.add({ uid, ...data })
   await db.metadata.add({ uid, created_at: now })
   // execute on server, asynchronously, if connection is active
   if (isConnected.value) {
      app.service('group').createWithMeta(uid, data, now)
      .catch(async err => {
         console.log("*** err sync group create", err)
         alert("An error occured", 3)
         // rollback
         await db.values.delete(uid)
      })
   }
   return await db.values.get(uid)
}

export const update = async (uid, data) => {
   const previousValue = { ...(await db.values.get(uid)) }
   const previousMetadata = { ...(await db.metadata.get(uid)) }
   // optimistic update of cache
   const now = new Date()
   await db.values.update(uid, data)
   await db.metadata.update(uid, { updated_at: now })
   // execute on server, asynchronously, if connection is active
   if (isConnected.value) {
      app.service('group').updateWithMeta(uid, data, now)
      .catch(async err => {
         console.log("*** err sync group update", err)
         alert("An error occured")
         // rollback
         delete previousValue.uid
         await db.values.update(uid, previousValue)
         delete previousMetadata.uid
         await db.metadata.update(uid, previousMetadata)
      })
   }
   return await db.values.get(uid)
}

export const remove = async (uid) => {
   // stop synchronizing on this perimeter
   removeSynchroWhere({ uid })
   // .. and on this perimeter for user_group_relation
   await removeSynchroUserGroupRelationWhere({ group_uid: uid })

   const deleted_at = new Date()

   // remove relations to users in cache, and in database if connected
   const userGroupRelations = await getManyUserGroupRelation({ group_uid: uid })
   await Promise.all(userGroupRelations.map(relation => removeGroupRelation(relation.uid)))

   // optimistic delete in cache
   await db.values.update(uid, { __deleted__: true })
   await db.metadata.update(uid, { deleted_at })
   // and in database, if connected
   if (isConnected.value) {
      // also update meta-data
      app.service('group').delete(uid)
      .catch(async err => {
         console.log("*** err sync group remove", err)
         alert("An error occured")
         // rollback
         await db.values.update(uid, { __deleted__: null })
         await db.metadata.update(uid, { deleted_at: null })
      })
   }
}


export function addSynchroWhere(where) {
   return addSynchroDBWhere(where, db.whereList)
}

export function removeSynchroWhere(where) {
   return removeSynchroDBWhere(where, db.whereList)
}

export async function synchronizeAll() {
   await synchronizeModelWhereList(app, 'group', db.values, db.metadata, disconnectedDate.value, db.whereList)
}

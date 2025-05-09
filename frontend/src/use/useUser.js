import Dexie from "dexie"
import { liveQuery } from "dexie"
import { uid as uid16 } from 'uid'
import { ref } from 'vue'

import { getMany as getManyUserGroupRelation, remove as removeGroupRelation } from '/src/use/useUserGroupRelation'
import { wherePredicate, synchronize, addSynchroWhere, removeSynchroWhere, synchronizeModelWhereList } from '/src/lib/synchronize.js'
import { app, isConnected, disconnectedDate } from '/src/client-app.js'

export const db = new Dexie(import.meta.env.VITE_APP_USER_IDB)

db.version(1).stores({
   whereList: "sortedjson, where",
   values: "uid, __deleted__, email, firstname, lastname",
   metadata: "uid, created_at, updated_at, deleted_at",
})

export const reset = async () => {
   await db.whereList.clear()
   await db.values.clear()
   await db.metadata.clear()
}


/////////////          PUB / SUB          /////////////

app.service('user').on('createWithMeta', async ([value, meta]) => {
   console.log('USER EVENT createWithMeta', value)
   await db.values.put(value)
   await db.metadata.put(meta)
})

app.service('user').on('updateWithMeta', async ([value, meta]) => {
   console.log('USER EVENT updateWithMeta', value)
   await db.values.put(value)
   await db.metadata.put(meta)
})

app.service('user').on('deleteWithMeta', async ([value, meta]) => {
   console.log('USER EVENT deleteWithMeta', value)
   await db.values.delete(value.uid)
   await db.metadata.put(meta)
})


/////////////          CACHE METHODS          /////////////

export async function getMany(where) {
   const predicate = wherePredicate(where)
   return await db.values.filter(value => !value.__deleted__ && predicate(value)).toArray()
}

export async function getFirst(where) {
   const predicate = wherePredicate(where)
   return await db.values.filter(value => !value.__deleted__ && predicate(value)).first()
}

/////////////          CRUD METHODS WITH SYNC          /////////////

// return an Observable
export async function findMany$(where) {
   const isNew = await addSynchroWhere(where, db.whereList)
   // run synchronization if connected and if `where` is new
   if (isNew && isConnected.value) {
      synchronize(app, 'user', db.values, db.metadata, where, disconnectedDate.value)
   }
   // return observable for `where` values
   const predicate = wherePredicate(where)
   return liveQuery(() => db.values.filter(value => !value.__deleted__ && predicate(value)).toArray())
}

export async function create(data) {
   const uid = uid16(16)
   // enlarge perimeter
   await addSynchroWhere({ uid }, db.whereList)
   // optimistic update
   const now = new Date()
   await db.values.add({ uid, ...data })
   // await db.values.add({ uid, email: data.email, firstname: data.firstname, lastname: data.lastname })
   await db.metadata.add({ uid, created_at: now })
   // execute on server, asynchronously, if connection is active
   if (isConnected.value) {
      app.service('user').createWithMeta(uid, data, now)
      .catch(err => {
         console.log("*** err sync user create", err)
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
      app.service('user').updateWithMeta(uid, data, now)
      .catch(async err => {
         console.log("*** err sync user update", err)
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
   await removeSynchroWhere({ uid }, db.whereList)
   const deleted_at = new Date()

   // remove relations to groups in cache
   const userGroupRelations = await getManyUserGroupRelation({ user_uid: uid })
   await Promise.all(userGroupRelations.map(relation => removeGroupRelation(relation.uid)))

   // optimistic delete in cache
   // await db.values.delete(uid)
   await db.values.update(uid, { __deleted__: true })
   await db.metadata.update(uid, { deleted_at })
   // and in database, if connected
   if (isConnected.value) {
      app.service('user').deleteWithMeta(uid, deleted_at)
      .catch(err => {
         console.log("*** err sync user remove", err)
      })
   }
}


export async function synchronizeWhere(where) {
   const isNew = await addSynchroWhere(where, db.whereList)
   // run synchronization if connected and if `where` is new
   if (isNew && isConnected.value) {
      await synchronize(app, 'user', db.values, db.metadata, where, disconnectedDate.value)
   }
}

export async function synchronizeAll() {
   await synchronizeModelWhereList(app, 'user', db.values, db.metadata, disconnectedDate.value, db.whereList)
}

/////////////          UTILITIES          /////////////

export function getFullname(user) {
   if (!user) return ''
   if (user.firstname && user.lastname) return user.lastname + ' ' + user.firstname
   return user.lastname || user.firstname
}

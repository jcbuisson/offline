import Dexie from "dexie"
import { liveQuery } from "dexie"
import { uid as uid16 } from 'uid'

import { wherePredicate, synchronize, addSynchroWhere, removeSynchroWhere, synchronizeModelWhereList } from '/src/lib/synchronize.js'
import { app, isConnected, disconnectedDate } from '/src/client-app.js'

export const db = new Dexie(import.meta.env.VITE_APP_USER_GROUP_RELATION_IDB)

db.version(1).stores({
   whereList: "sortedjson, where",
   values: "uid, __deleted__, user_uid, group_uid",
   metadata: "uid, created_at, updated_at, deleted_at",
})

export const reset = async () => {
   await db.whereList.clear()
   await db.values.clear()
   await db.metadata.clear()
}

/////////////          PUB / SUB          /////////////

app.service('user_group_relation').on('create', async ([value, meta]) => {
   console.log('USER_GROUP_RELATION EVENT created', value)
   await db.values.put(value)
   await db.metadata.put(meta)
})

app.service('user_group_relation').on('update', async ([value, meta]) => {
   console.log('USER_GROUP_RELATION EVENT update', value)
   await db.values.put(value)
   await db.metadata.put(meta)
})

app.service('user_group_relation').on('delete', async ([value, meta]) => {
   console.log('USER_GROUP_RELATION EVENT delete', value)
   await db.values.delete(value.uid)
   await db.metadata.put(meta)
})


/////////////          CACHE METHODS          /////////////

export async function getMany(where) {
   const predicate = wherePredicate(where)
   return await db.values.filter(value => !value.__deleted__ && predicate(value)).toArray()
}

/////////////          CRUD METHODS WITH SYNC          /////////////

// return an Observable
export async function findMany$(where) {
   const isNew = await addSynchroWhere(where, db.whereList)
   // run synchronization if connected and if `where` is new
   if (isNew && isConnected.value) {
      synchronize(app, 'user_group_relation', db.values, db.metadata, where, disconnectedDate.value)
   }
   // return observable for `where` values
   const predicate = wherePredicate(where)
   return liveQuery(() => db.values.filter(value => !value.__deleted__ && predicate(value)).toArray())
}

export async function updateUserGroups(user_uid, newGroupUIDs) {
   try {
      // enlarge perimeter
      await addSynchroWhere({ user_uid }, db.whereList)
      const now = new Date()

      // build list of active user-group relations with `user_uid`
      const allUserRelations = await db.values.filter(value => value.user_uid === user_uid).toArray()
      const currentUserRelations = []
      for (const relation of allUserRelations) {
         const metadata = await db.metadata.get(relation.uid)
         if (metadata.deleted_at) continue
         currentUserRelations.push(relation)
      }

      // add new relations
      for (const group_uid of newGroupUIDs) {
         if (!currentUserRelations.some(relation => relation.group_uid === group_uid)) {
            // add in client cache
            const uid = uid16(16)
            await db.values.add({ uid, user_uid, group_uid })
            await db.metadata.add({ uid, created_at: now })
            // add in database, asynchronously, if connection is active
            if (isConnected.value) {
               app.service('user_group_relation').createWithMeta(uid, { user_uid, group_uid }, now)
               .catch(err => {
                  console.log("*** err sync user_group_relation updateUserGroups", err)
               })
            }
         }
      }

      // remove existing relations in client cache
      for (const relation of currentUserRelations) {
         if (!newGroupUIDs.includes(relation.group_uid)) {
            // remove from client cache
            // await db.values.delete(relation.uid)
            await db.values.update(relation.uid, { __deleted__: true })
            await db.metadata.update(relation.uid, { deleted_at: now })
            // remove from database, asynchronously, if connection is active
            if (isConnected.value) {
               app.service('user_group_relation').delete(relation.uid)
               .catch(err => {
                  console.log("*** err sync user_group_relation updateUserGroups", err)
               })
            }
         }
      }
   } catch(err) {
      console.log('*** err updateUserGroups', err)
   }
}

export async function remove(uid) {
   // stop synchronizing on this perimeter
   removeSynchroWhere({ uid }, db.whereList)
   const deleted_at = new Date()
   // optimistic delete
   await db.values.delete(uid)
   await db.metadata.update(uid, { deleted_at })
   // execute on server, asynchronously, if connection is active
   if (isConnected.value) {
      app.service('user_group_relation').delete(uid)
      .catch(err => {
         console.log("*** err sync user_group_relation remove", err)
      })
   }
}

export async function synchronizeAll() {
   await synchronizeModelWhereList(app, 'user_group_relation', db.values, db.metadata, disconnectedDate.value, db.whereList)
}

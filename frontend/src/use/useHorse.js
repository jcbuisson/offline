import { ref, computed } from 'vue'
import { v4 as uuidv4 } from 'uuid'
import Dexie from "dexie"

import { app, offlineDate } from '/src/client-app.js'
import { synchronize } from '/src/lib/sync.js'


const db = new Dexie("horseDatabase")

db.version(1).stores({
   requests: "hash, where",
   horses: "uid, createdAt, updatedAt, deleted_, name, stable_id"
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

export async function getHorse(horse_uid) {
   return db.horses.get(horse_uid)
}

export function getHorseList(stable_uid) {
   return db.horses.filter(horse => !horse.deleted_ && horse.stable_uid === stable_uid).toArray()
}

app.addConnectListener(async (socket) => {
   console.log('websocket reconnection: synchronizing...')
   const where = {}
   await synchronize(app.service('horse'), db.horses, where, offlineDate.value)
})


// // ex: where = { stable_id: 'azer' }
// export async function synchronize(where) {
//    const requestPredicate = (elt) => {
//       for (const [key, value] of Object.entries(where)) {
//          // implements only 'attr = value' clauses 
//          if (elt[key] !== value) return false
//       }
//       return true
//    }

//    const allValues = await db.horses.toArray()
//    const clientValuesDict = allValues.reduce((accu, elt) => {
//       if (requestPredicate(elt)) accu[elt.uid] = elt
//       return accu
//    }, {})

//    // send local data to sync service which stores new data and returns local changes to be made
//    const { toAdd, toUpdate, toDelete } = await app.service('horse').sync(where, offlineDate.value, clientValuesDict)
//    console.log(toAdd, toUpdate, toDelete)
//    // update cache according to server sync directives
//    // 1- add missing elements
//    for (const horse of toAdd) {
//       await db.horses.add(horse)
//    }
//    // 2- delete removed elements
//    for (const uid of toDelete) {
//       await db.horses.delete(uid)
//    }
//    // 3- update elements
//    for (const horse of toUpdate) {
//       await db.horses.update(horse.uid, horse)
//    }
// }

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

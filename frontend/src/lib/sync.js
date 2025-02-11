
// ex: where = { uid: 'azer' }
export async function synchronize(modelService, modelCache, where, cutoffDate) {
   const requestPredicate = (elt) => {
      for (const [key, value] of Object.entries(where)) {
         // implements only 'attr = value' clauses 
         if (elt[key] !== value) return false
      }
      return true
   }

   const allValues = await modelCache.toArray()
   const clientValuesDict = allValues.reduce((accu, elt) => {
      if (requestPredicate(elt)) accu[elt.uid] = elt
      return accu
   }, {})

   // send cache data to sync service which stores new data and returns local changes to be made
   const { toAdd, toUpdate, toDelete } = await modelService.sync(where, cutoffDate, clientValuesDict)
   console.log(toAdd, toUpdate, toDelete)
   // update client cache according to server sync directives
   // 1- add missing elements
   for (const elt of toAdd) {
      await modelCache.add(elt)
   }
   // 2- delete removed elements
   for (const uid of toDelete) {
      await modelCache.delete(uid)
   }
   // 3- update elements
   for (const elt of toUpdate) {
      await modelCache.update(elt.uid, elt)
   }
}

function isIncluded(where, whereList) {
   for (const w of whereList) {
      if (isSubset(w, where)) return true
   }
   return false
}

function isSubset(subset, fullObject) {
   return Object.entries(subset).every(([key, value]) => fullObject[key] === value);
}
 
async function getWhereList(whereDb) {
   // whereDb has a single row of id=0
   let whereListRec = await whereDb.get(0)
   if (!whereListRec) { await whereDb.add({ id: 0, value: []}) }
   whereListRec = await whereDb.get(0)
   return whereListRec.value
}

export async function handleWhere(where, whereDb) {
   const whereList = await getWhereList(whereDb)
   // if `where` is identical or more specific than an element of `whereList`, return false
   if (isIncluded(where, whereList)) return false
   whereList.push(where)
   await whereDb.update(0, whereList)
   return true
}

export async function synchronizeAll(modelService, modelCache, cutoffDate, whereDb) {
   const whereList = await getWhereList(whereDb)
   for (const where of whereList) {
      await synchronize(modelService, modelCache, where, cutoffDate)
   }
}
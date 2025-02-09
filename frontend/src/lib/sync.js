
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
   for (const stable of toAdd) {
      await modelCache.add(stable)
   }
   // 2- delete removed elements
   for (const uid of toDelete) {
      await modelCache.delete(uid)
   }
   // 3- update elements
   for (const stable of toUpdate) {
      await modelCache.update(stable.uid, stable)
   }
}


// ex: where = { uid: 'azer' }
export async function synchronize(service, dbModel, where, cutoffDate) {
   const requestPredicate = (elt) => {
      for (const [key, value] of Object.entries(where)) {
         // implements only 'attr = value' clauses 
         if (elt[key] !== value) return false
      }
      return true
   }

   const allValues = await dbModel.toArray()
   const clientValuesDict = allValues.reduce((accu, elt) => {
      if (requestPredicate(elt)) accu[elt.uid] = elt
      return accu
   }, {})

   // send local data to server and ask for local changes to be made (add, update, delete) to be in sync
   const { toAdd, toUpdate, toDelete } = await service.sync(where, cutoffDate, clientValuesDict)
   console.log(toAdd, toUpdate, toDelete)
   // update cache according to server sync directives
   // 1- add missing elements
   for (const stable of toAdd) {
      await dbModel.add(stable)
   }
   // 2- delete removed elements
   for (const uid of toDelete) {
      await dbModel.delete(uid)
   }
   // 3- update elements
   for (const stable of toUpdate) {
      await dbModel.update(stable.uid, stable)
   }
}

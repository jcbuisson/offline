
import { v7 as uuidv7 } from 'uuid'

let model;

export default function(app) {
   if (!model) {
      const electricModel = app.createElectricModel('user_group_relation', { primaryKey: 'uid' });
      model = { ...electricModel, create: data => electricModel.create(uuidv7(), data) }
   }
   return { ...model, groupDifference }


   /////////////          UTILITY          /////////////

   async function groupDifference(user_uid, newGroupUIDs) {
      const toAddGroupUIDs = []
      const toRemoveRelationUIDs = []
      // collect active user-group relations with `user_uid`
      const currentUserRelations = await model.findMany({ user_uid })
      // relations to add
      for (const group_uid of newGroupUIDs) {
         if (!currentUserRelations.some(relation => relation.group_uid === group_uid)) {
            toAddGroupUIDs.push(group_uid)
         }
      }
      // relations to remove
      for (const relation of currentUserRelations) {
         if (!newGroupUIDs.includes(relation.group_uid)) {
            toRemoveRelationUIDs.push(relation.uid)
         }
      }
      return [toAddGroupUIDs, toRemoveRelationUIDs]
   }
}

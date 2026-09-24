import { getSyncModel } from '../sync'

import { v7 as uuidv7 } from 'uuid'
import { shareReplay } from 'rxjs'

let model;

export default function(app) {
   if (!model) {
      const electricModel = getSyncModel('user_group_relation');
      const all$ = electricModel.getObservable({}).pipe(
         shareReplay({ bufferSize: 1, refCount: true }),
      )
      model = {
         ...electricModel,
         getObservable: (where = {}) => Object.keys(where).length === 0
            ? all$
            : electricModel.getObservable(where),
         create: data => electricModel.create({ ...data, uid: uuidv7() }),
      }
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

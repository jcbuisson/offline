import { v7 as uuidv7 } from 'uuid'
import { combineLatest, map, shareReplay } from 'rxjs'
import useUser from './useUser'
import useGroup from './useGroup'

let model;

export default function(app) {
   if (!model) {
      const electricModel = app.createElectricModel('user_group_relation');
      const users$ = useUser(app).getObservable({})
      const groups$ = useGroup(app).getObservable({})

      // Hide memberships immediately when either parent is deleted locally.
      // Their authoritative tombstones arrive after the server processes the delete.
      const visibleRelations = (where = {}) => combineLatest([
         electricModel.getObservable(where), users$, groups$,
      ]).pipe(map(([relations, users, groups]) => {
         const userUIDs = new Set(users.map(user => user.uid))
         const groupUIDs = new Set(groups.map(group => group.uid))
         // keep only relations whose both ends exist locally
         return relations.filter(relation => userUIDs.has(relation.user_uid) && groupUIDs.has(relation.group_uid))
      }))
      
      model = {
         ...electricModel,
         getObservable: (where = {}) => visibleRelations(where),
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

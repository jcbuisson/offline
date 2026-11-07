import { v7 as uuidv7 } from 'uuid'

let model;
const membershipWrites = new Map();

export default function(app) {
   if (!model) {
      const pgcouchModel = app.createPGCouchModel('user_group_relation');
      model = {
         ...pgcouchModel,
         create: data => pgcouchModel.create({ ...data, uid: uuidv7() }),
      }
   }
   return { ...model, groupDifference, setGroups }


   /////////////          UTILITY          /////////////

   function setGroups(user_uid, groupUIDs) {
      const selected = [...new Set(groupUIDs)]
      const previous = membershipWrites.get(user_uid) ?? Promise.resolve()
      const write = previous.catch(() => {}).then(async () => {
         const [toAdd, toRemove] = await groupDifference(user_uid, selected)
         for (const group_uid of toAdd) await model.create({ user_uid, group_uid })
         for (const uid of toRemove) await model.remove(uid)
      })
      membershipWrites.set(user_uid, write)
      const cleanup = () => {
         if (membershipWrites.get(user_uid) === write) membershipWrites.delete(user_uid)
      }
      void write.then(cleanup, cleanup)
      return write
   }

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

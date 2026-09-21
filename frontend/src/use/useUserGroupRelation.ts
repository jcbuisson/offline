
import { v7 as uuidv7 } from 'uuid'
import { BehaviorSubject, filter, firstValueFrom, map } from 'rxjs'

let model;

export default function(app) {
   if (!model) {
      const electricModel = app.createElectricModel('user_group_relation', { primaryKey: 'uid' });
      const rows$ = new BehaviorSubject([])
      let initialized = false

      // Maintain one application-wide relation cache. Local mutation results are
      // applied immediately; Electric subsequently reconciles the authoritative
      // PostgreSQL state into the same stream.
      electricModel.getObservable({}).subscribe(rows => {
         initialized = true
         rows$.next(rows)
      })

      const getObservable = (where = {}) => rows$.pipe(
         map(rows => rows.filter(row =>
            Object.entries(where).every(([field, value]) => row[field] === value)
         )),
      )

      const create = async data => {
         const relation = await electricModel.create(uuidv7(), data)
         rows$.next([...rows$.value.filter(row => row.uid !== relation.uid), relation])
         return relation
      }

      const remove = async uid => {
         const relation = await electricModel.remove(uid)
         rows$.next(rows$.value.filter(row => row.uid !== uid))
         return relation
      }

      model = {
         ...electricModel,
         getObservable,
         findMany: async (where = {}) => {
            if (!initialized) {
               await firstValueFrom(rows$.pipe(filter(() => initialized)))
            }
            return firstValueFrom(getObservable(where))
         },
         create,
         remove,
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

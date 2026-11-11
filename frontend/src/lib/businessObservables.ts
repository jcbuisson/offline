import { combineLatest, map, shareReplay } from 'rxjs'

import useUser from '/src/use/useUser'
import useGroup from '/src/use/useGroup'
import useUserGroupRelation from '/src/use/useUserGroupRelation'

import useExpressXClient from '/src/useExpressXClient.ts'
const { app } = useExpressXClient()

const { getObservable: users$ } = useUser(app)
const { getObservable: groups$ } = useGroup(app)
const { getObservable: userGroupRelations$ } = useUserGroupRelation(app)

// These application-wide lists outlive routed views. Keep their subscriptions
// alive between mounts so tab switches replay current data synchronously rather
// than starting another worker query. Worker disposal closes them with the app.
export const allUsers$ = users$({}).pipe(shareReplay({ bufferSize: 1, refCount: false }))
export const allGroups$ = groups$({}).pipe(shareReplay({ bufferSize: 1, refCount: false }))
export const allUserGroupRelations$ = userGroupRelations$({}).pipe(shareReplay({ bufferSize: 1, refCount: false }))

export function userGroups$(user_uid: string) {
   return combineLatest([allGroups$, allUserGroupRelations$]).pipe(
      map(([groups, relations]) => {
         const groupUIDs = new Set(
            relations
               .filter(relation => relation.user_uid === user_uid)
               .map(relation => relation.group_uid),
         )
         return groups.filter(group => groupUIDs.has(group.uid))
      }),
   )
}

export const userAndGroups$ = combineLatest([
   allUsers$,
   allGroups$,
   allUserGroupRelations$,
]).pipe(
   map(([users, groups, relations]) => {
      const groupsByUID = new Map(groups.map(group => [group.uid, group]))
      const groupUIDsByUserUID = new Map<string, string[]>()

      for (const relation of relations) {
         const groupUIDs = groupUIDsByUserUID.get(relation.user_uid) ?? []
         groupUIDs.push(relation.group_uid)
         groupUIDsByUserUID.set(relation.user_uid, groupUIDs)
      }

      return users.map(user => ({
         user,
         groups: (groupUIDsByUserUID.get(user.uid) ?? [])
            .map(groupUID => groupsByUID.get(groupUID))
            .filter(Boolean),
      }))
   }),
)

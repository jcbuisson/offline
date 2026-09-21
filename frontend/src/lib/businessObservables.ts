import { combineLatest, map, shareReplay, startWith } from 'rxjs'

import useUser from '/src/use/useUser'
import useGroup from '/src/use/useGroup'
import useUserGroupRelation from '/src/use/useUserGroupRelation'

import { app } from '/src/client-app.ts'

const { getObservable: users$ } = useUser(app)
const { getObservable: groups$ } = useGroup(app)
const { getObservable: userGroupRelations$ } = useUserGroupRelation(app)

// Keep one Shape per table and perform relational joins locally. Opening Shapes
// per row quickly exhausts the browser's HTTP/1.1 connection limit.
const allUsers$ = users$({}).pipe(shareReplay({ bufferSize: 1, refCount: true }))
const allGroups$ = groups$({}).pipe(
   startWith([]),
   shareReplay({ bufferSize: 1, refCount: true }),
)
const allUserGroupRelations$ = userGroupRelations$({}).pipe(
   startWith([]),
   shareReplay({ bufferSize: 1, refCount: true }),
)

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

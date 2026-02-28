import { Observable, from, map, of, merge, combineLatest, firstValueFrom } from 'rxjs'
import { mergeMap, switchMap, scan, tap, catchError } from 'rxjs/operators'

import { groupModel, userGroupRelationModel } from '/src/client-app.ts';

const { getObservable: groups$ } = groupModel;
const { getObservable: userGroupRelations$ } = userGroupRelationModel;


export function guardCombineLatest(observables) {
   if (observables.length === 0) {
      // If the array is empty, immediately return an Observable that emits an empty array
      return of([])
   } else {
      // Otherwise, proceed with combineLatest
      return combineLatest(observables)
   }
}

export function userGroups$(user_uid: string) {
   return userGroupRelations$({ user_uid }).pipe(
      switchMap(relations =>
         guardCombineLatest(relations.map(relation => groups$({ uid: relation.group_uid }).pipe(map(groups => groups[0]))))
      ),
   )
}

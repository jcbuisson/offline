import { getSyncModel } from '../sync'

import { v7 as uuidv7 } from 'uuid'
import { shareReplay } from 'rxjs'

let model;

export default function(app) {
   if (!model) {
      const electricModel = getSyncModel('group');
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
   return model
}

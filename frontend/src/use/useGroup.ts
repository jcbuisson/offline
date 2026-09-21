
import { v7 as uuidv7 } from 'uuid'
import { shareReplay } from 'rxjs'

let model;

export default function(app) {
   if (!model) {
      const electricModel = app.createElectricModel('group', { primaryKey: 'uid' });
      const all$ = electricModel.getObservable({}).pipe(
         shareReplay({ bufferSize: 1, refCount: true }),
      )
      model = {
         ...electricModel,
         getObservable: (where = {}) => Object.keys(where).length === 0
            ? all$
            : electricModel.getObservable(where),
         create: data => electricModel.create(uuidv7(), data),
      }
   }
   return model
}

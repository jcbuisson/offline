import { v7 as uuidv7 } from 'uuid'
import { shareReplay } from 'rxjs'
import useElectricModel from './useElectricModel'

let model;

export default function(app) {
   if (!model) {
      const electricModel = useElectricModel(app, 'user');
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

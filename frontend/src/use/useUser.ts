
import { v7 as uuidv7 } from 'uuid'

let model;

export default function(app) {
   if (!model) {
      const electricModel = app.createElectricModel('user', { primaryKey: 'uid' });
      model = { ...electricModel, create: data => electricModel.create(uuidv7(), data) }
   }
   return model
}

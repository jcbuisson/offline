import { v7 as uuidv7 } from 'uuid'

let model;

export default function(app) {
   if (!model) {
      const electricModel = app.createElectricModel('group');
      model = {
         ...electricModel,
         create: data => electricModel.create({ ...data, uid: uuidv7() }),
      }
   }
   return model
}

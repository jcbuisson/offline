import { v7 as uuidv7 } from 'uuid'

let model;

export default function(app) {
   if (!model) {
      const pgcouchModel = app.createPGCouchModel('user');
      model = {
         ...pgcouchModel,
         create: data => pgcouchModel.create({ ...data, uid: uuidv7() }),
      }
   }
   return model
}


let model;

export default function(app) {
   if (!model) model = app.createOfflineModel('user', ['email']);
   return { ...model }
}
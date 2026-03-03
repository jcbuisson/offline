
let model;

export default function(app) {
   if (!model) model = app.createOfflineModel('group', ['name']);
   return { ...model }
}
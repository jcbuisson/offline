
export default function(app) {

   app.service('user').publish(async (context) => {
      return ['anonymous']
   })
      
   app.service('group').publish(async (context) => {
      return ['anonymous']
   })
      
   app.service('relation').publish(async (context) => {
      return ['anonymous']
   })
}


export default function(app) {

   app.service('user').publish(async (context) => {
      return ['anonymous']
   })
      
   app.service('group').publish(async (context) => {
      return ['anonymous']
   })
      
   app.service('user_group_relation').publish(async (context) => {
      return ['anonymous']
   })
}

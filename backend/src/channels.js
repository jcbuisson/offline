
export default function(app) {

   app.service('stable').publish(async (context) => {
      return ['anonymous']
   })
      
   app.service('horse').publish(async (context) => {
      return ['anonymous']
   })
}


export default function (app) {

   const prisma = app.get('prisma')

   app.createService('user', {
      ...prisma.user
   })

}

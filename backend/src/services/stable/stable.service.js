
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('stable', {
      ...prisma.stable
   })

}

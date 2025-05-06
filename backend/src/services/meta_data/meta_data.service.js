
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('meta_data', {
      ...prisma.meta_data
   })

}

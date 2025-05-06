
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('group', {

      findUnique: prisma.group.findUnique,

      findMany: prisma.group.findMany,
      
      create: async (uid, data) => {
         await prisma.$transaction([
            prisma.group.create({ data: { uid, ...data } }),
            prisma.meta_data.create({ data: { uid, created_at: new Date() } })
         ])
      },
      
      update: async (uid, data) => {
         await prisma.$transaction([
            prisma.group.update({ where: { uid }, data }),
            prisma.meta_data.update({ where: { uid }, data: { uid, updated_at: new Date() } })
         ])
      },
      
      delete: async (uid) => {
         await prisma.$transaction([
            prisma.group.delete({ where: { uid } }),
            prisma.meta_data.update({ where: { uid }, data: { uid, deleted_at: new Date() } })
         ])
      },
   })


}

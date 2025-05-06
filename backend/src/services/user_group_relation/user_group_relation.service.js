
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('user_group_relation', {

      findUnique: prisma.user_group_relation.findUnique,

      findMany: prisma.user_group_relation.findMany,
      
      create: async (uid, data) => {
         await prisma.$transaction([
            prisma.user_group_relation.create({ data: { uid, ...data } }),
            prisma.meta_data.create({ data: { uid, created_at: new Date() } })
         ])
      },
      
      update: async (uid, data) => {
         await prisma.$transaction([
            prisma.user_group_relation.update({ where: { uid }, data }),
            prisma.meta_data.update({ where: { uid }, data: { uid, updated_at: new Date() } })
         ])
      },
      
      delete: async (uid) => {
         await prisma.$transaction([
            prisma.user_group_relation.delete({ where: { uid } }),
            prisma.meta_data.update({ where: { uid }, data: { uid, deleted_at: new Date() } })
         ])
      },
   })


}

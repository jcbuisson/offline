
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('user_group_relation', {

      findUnique: prisma.user_group_relation.findUnique,

      findMany: prisma.user_group_relation.findMany,
      
      create: async (uid, data) => {
         const [value, metadata] = await prisma.$transaction([
            prisma.user_group_relation.create({ data: { uid, ...data } }),
            prisma.meta_data.create({ data: { uid, created_at: new Date() } })
         ])
         return value
      },
      
      update: async (uid, data) => {
         const [value, metadata] = await prisma.$transaction([
            prisma.user_group_relation.update({ where: { uid }, data }),
            prisma.meta_data.update({ where: { uid }, data: { updated_at: new Date() } })
         ])
         return value
      },
      
      delete: async (uid) => {
         const [value, metadata] = await prisma.$transaction([
            prisma.user_group_relation.delete({ where: { uid } }),
            prisma.meta_data.update({ where: { uid }, data: { deleted_at: new Date() } })
         ])
         return value
      },
   })


}

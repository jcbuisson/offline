
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('user', {

      findUnique: prisma.user.findUnique,

      findMany: prisma.user.findMany,
      
      create: async (uid, data) => {
         const [user, meta] = await prisma.$transaction([
            prisma.user.create({ data: { uid, ...data } }),
            prisma.meta_data.create({ data: { uid, created_at: new Date() } })
         ])
         return user
      },
      
      update: async (uid, data) => {
         const [user, meta] = await prisma.$transaction([
            prisma.user.update({ where: { uid }, data }),
            prisma.meta_data.update({ where: { uid }, data: { updated_at: new Date() } })
         ])
         return user
      },
      
      delete: async (uid) => {
         const [user, meta] = await prisma.$transaction([
            prisma.user.delete({ where: { uid } }),
            prisma.meta_data.update({ where: { uid }, data: { deleted_at: new Date() } })
         ])
         return user
      },
   })

}

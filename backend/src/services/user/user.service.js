
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('user', {

      findUnique: prisma.user.findUnique,

      findMany: prisma.user.findMany,

      findWithMeta: async (uid) => {
         const [value, meta] = await prisma.$transaction([
            prisma.user.findUnique({ where: { uid } }),
            prisma.meta_data.get(uid)
         ])
         return [value, meta]
      },
      
      createWithMeta: async (uid, data, created_at) => {
         const [value, meta] = await prisma.$transaction([
            prisma.user.create({ data: { uid, ...data } }),
            prisma.meta_data.create({ data: { uid, created_at } })
         ])
         return [value, meta]
      },
      
      update: async (uid, data) => {
         const [value, meta] = await prisma.$transaction([
            prisma.user.update({ where: { uid }, data }),
            prisma.meta_data.update({ where: { uid }, data: { updated_at: new Date() } })
         ])
         return [value, meta]
      },
      
      delete: async (uid) => {
         const [value, meta] = await prisma.$transaction([
            prisma.user.delete({ where: { uid } }),
            prisma.meta_data.update({ where: { uid }, data: { deleted_at: new Date() } })
         ])
         return [value, meta]
      },
   })

}

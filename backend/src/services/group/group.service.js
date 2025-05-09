
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('group', {

      findUnique: prisma.group.findUnique,

      findMany: prisma.group.findMany,
      
      createWithMeta: async (uid, data, created_at) => {
         const [value, meta] = await prisma.$transaction([
            prisma.group.create({ data: { uid, ...data } }),
            prisma.meta_data.create({ data: { uid, created_at } })
         ])
         return [value, meta]
      },
      
      update: async (uid, data) => {
         const [value, meta] = await prisma.$transaction([
            prisma.group.update({ where: { uid }, data }),
            prisma.meta_data.update({ where: { uid }, data: { updated_at: new Date() } })
         ])
         return [value, meta]
      },
      
      delete: async (uid) => {
         const [value, meta] = await prisma.$transaction([
            prisma.group.delete({ where: { uid } }),
            prisma.meta_data.update({ where: { uid }, data: { deleted_at: new Date() } })
         ])
         return [value, meta]
      },
   })


}

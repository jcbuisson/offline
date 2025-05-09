
export default function (app) {

   const prisma = app.get('prisma')

   app.createService('user', {

      findUnique: prisma.user.findUnique,
      findMany: prisma.user.findMany,

      findByIdWithMeta: async (uid) => {
         const [value, meta] = await prisma.$transaction([
            prisma.user.findUnique({ where: { uid } }),
            prisma.metadata.findUnique({ where: { uid } }),
         ])
         return [value, meta]
      },

      findManyWithMeta: async (where) => {
         const valueList = await prisma.user.findMany({ where })
         const metaList = []
         for (const value of valueList) {
            const meta = prisma.metadata.findUnique({ where: { uid: value.uid } })
            metaList.push(meta)
         }
         return valueList.map((value, index) => [ value, metaList[index] ])
      },
      
      createWithMeta: async (uid, data, created_at) => {
         const [value, meta] = await prisma.$transaction([
            prisma.user.create({ data: { uid, ...data } }),
            prisma.metadata.create({ data: { uid, created_at } })
         ])
         return [value, meta]
      },
      
      update: async (uid, data) => {
         const [value, meta] = await prisma.$transaction([
            prisma.user.update({ where: { uid }, data }),
            prisma.metadata.update({ where: { uid }, data: { updated_at: new Date() } })
         ])
         return [value, meta]
      },
      
      delete: async (uid) => {
         const [value, meta] = await prisma.$transaction([
            prisma.user.delete({ where: { uid } }),
            prisma.metadata.update({ where: { uid }, data: { deleted_at: new Date() } })
         ])
         return [value, meta]
      },
   })

}

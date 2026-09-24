import { prepareElectricSyncSchema } from '@jcbuisson/express-x-plugins/electric-server'

export const syncModels = [
   { name: 'user', primaryKey: 'uid', tombstoneData: { email: null } },
   { name: 'group', primaryKey: 'uid', tombstoneData: { name: null } },
   { name: 'user_group_relation', primaryKey: 'uid', tombstoneData: { user_uid: null, group_uid: null } },
]

export async function prepareSyncSchema(db) {
   const tx = await db.connect()
   try {
      await tx.query('BEGIN')
      // A deletion can arrive before its offline create. Empty relation tombstones
      // must be insertable, and must release the unique user/group pair.
      await tx.query(`ALTER TABLE user_group_relation
         ALTER COLUMN user_uid DROP NOT NULL,
         ALTER COLUMN group_uid DROP NOT NULL`)
      await prepareElectricSyncSchema(tx, syncModels)
      await tx.query('COMMIT')
   } catch (error) {
      await tx.query('ROLLBACK')
      throw error
   } finally {
      tx.release()
   }
}

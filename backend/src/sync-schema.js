import { prepareElectricSyncSchema } from '@jcbuisson/express-x-plugins/electric-server'

export const syncModels = [
   { name: 'user', primaryKey: 'uid', tombstoneData: { email: null } },
   { name: 'group', primaryKey: 'uid', tombstoneData: { name: null } },
   { name: 'user_group_relation', primaryKey: 'uid', tombstoneData: { user_uid: null, group_uid: null } },
]

// add synchronization infrastructure
export async function prepareSyncSchema(db) {
   const tx = await db.connect()
   try {
      await tx.query('BEGIN')

      // allows deletion placeholders
      await tx.query(`ALTER TABLE user_group_relation
         ALTER COLUMN user_uid DROP NOT NULL,
         ALTER COLUMN group_uid DROP NOT NULL`)
      
      // add a version column, a deleted flag on each synced table, a sequence generating versions,
      // a mutation cursor table that prevents duplicate or older client mutations from being reapplied
      await prepareElectricSyncSchema(tx, syncModels)

      await tx.query('COMMIT')
   } catch (error) {
      await tx.query('ROLLBACK')
      throw error
   } finally {
      tx.release()
   }
}

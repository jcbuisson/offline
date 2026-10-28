import { v7 as uuidv7 } from 'uuid'
import { Observable, map, shareReplay } from 'rxjs'

const columns = {
   user: ['firstname', 'lastname', 'email'],
   group: ['name'],
   user_group_relation: ['user_uid', 'group_uid'],
}

export default function createSqlModel(app, name: keyof typeof columns) {
   const all$ = new Observable<any[]>(subscriber => app.sql.watch(
      name, { where: 'NOT deleted' }, rows => subscriber.next(rows),
   )).pipe(shareReplay({ bufferSize: 1, refCount: true }))
   const matches = (row, where) => Object.entries(where).every(([key, value]) => row[key] === value)

   return {
      getObservable: (where = {}) => all$.pipe(map(rows => rows.filter(row => matches(row, where)))),

      async findMany(where = {}) {
         const rows = await app.sql.query(`${name}.list`)
         return rows.filter(row => matches(row, where))
      },

      async findUnique(where) { return (await this.findMany(where))[0] ?? null },

      async create(data) {
         const [row] = await app.sql.query(`${name}.create`, [uuidv7(), ...columns[name].map(field => data[field] ?? null)])
         return row
      },

      async update(uid, data) {
         let row
         for (const [field, value] of Object.entries(data)) {
            if (!columns[name].includes(field)) throw new Error(`Unknown ${name} field: ${field}`)
            ;[row] = await app.sql.query(`${name}.update.${field}`, [uid, value])
         }
         return row
      },
      
      async remove(uid) { return (await app.sql.query(`${name}.remove`, [uid]))[0] },
   }
}

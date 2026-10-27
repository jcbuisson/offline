export const tables = ['user', 'group', 'user_group_relation']
const columns = {
   user: ['firstname', 'lastname', 'email'],
   group: ['name'],
   user_group_relation: ['user_uid', 'group_uid'],
}

// SQL identifiers come exclusively from this configuration; values use pg parameters.
export const statements = Object.fromEntries(tables.flatMap(table => {
   const fields = columns[table]
   return [
      [`${table}.list`, `SELECT * FROM "${table}" WHERE NOT deleted`],
      [`${table}.create`, `INSERT INTO "${table}" (uid, ${fields.join(', ')}) VALUES ($1, ${fields.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING *`],
      [`${table}.remove`, `DELETE FROM "${table}" WHERE uid = $1 RETURNING *`],
      ...fields.map(field => [`${table}.update.${field}`, `UPDATE "${table}" SET "${field}" = $2 WHERE uid = $1 AND NOT deleted RETURNING *`]),
   ]
}))

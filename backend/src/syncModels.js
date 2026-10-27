// Keep schema preparation and mutation services on the same complete graph.
export default [
   { name: 'user', primaryKey: 'uid', tombstoneData: { email: null } },
   { name: 'group', primaryKey: 'uid', tombstoneData: { name: null } },
   { name: 'user_group_relation', primaryKey: 'uid', tombstoneData: { user_uid: null, group_uid: null } },
]

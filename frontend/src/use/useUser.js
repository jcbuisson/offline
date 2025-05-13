
import useModel from '/src/use/useModel'
// import { getMany as getManyUserGroupRelation, remove as removeGroupRelation, removeSynchroWhere as removeSynchroUserGroupRelationWhere } from '/src/use/useUserGroupRelation'


/////////////          CRUD/SYNC METHODS          /////////////

const {
   db, reset,
   getMany, getFirst, findMany$, create, update, remove,
   addSynchroWhere, removeSynchroWhere, synchronizeWhere, synchronizeAll,
} = useModel(import.meta.env.VITE_APP_USER_IDB, 'user', ['email', 'firstname', 'lastname'])


/////////////          UTILITIES          /////////////

function getFullname(user) {
   if (!user) return ''
   if (user.firstname && user.lastname) return user.lastname + ' ' + user.firstname
   return user.lastname || user.firstname
}

export {
   db, reset,
   getMany, getFirst, findMany$, create, update, remove,
   addSynchroWhere, removeSynchroWhere, synchronizeWhere, synchronizeAll,
   
   getFullname,
}

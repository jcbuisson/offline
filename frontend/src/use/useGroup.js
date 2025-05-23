
import useModel from '/src/use/useModel'


/////////////          CRUD/SYNC METHODS          /////////////

const {
   db, reset,
   getFirst, create, update, remove,
   addPerimeter,
   addSynchroWhere, removeSynchroWhere, synchronizeWhere, synchronizeAll,
} = useModel(import.meta.env.VITE_APP_GROUP_IDB, 'group', ['name'])


export {
   db, reset,
   create, update, remove,
   addPerimeter,
   addSynchroWhere, removeSynchroWhere, synchronizeWhere, synchronizeAll,
}

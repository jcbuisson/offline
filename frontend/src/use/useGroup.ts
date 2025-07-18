
import useModel from '/src/use/useModel'

export function useGroup() {
   return useModel(import.meta.env.VITE_APP_GROUP_IDB, 'group', ['name'])
}

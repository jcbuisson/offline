
import userService from './user/user.service.js'
import groupService from './group/group.service.js'
import userGroupRelationService from './user_group_relation/user_group_relation.service.js'

import syncService from './sync/sync.service.js'

export default function (app) {
   app.configure(userService)
   app.configure(groupService)
   app.configure(userGroupRelationService)

   app.configure(syncService)
}

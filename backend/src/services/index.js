
import userService from './user/user.service.js'
import groupService from './group/group.service.js'
import relationService from './relation/relation.service.js'

import syncService from './sync/sync.service.js'

export default function (app) {
   app.configure(userService)
   app.configure(groupService)
   app.configure(relationService)

   app.configure(syncService)
}

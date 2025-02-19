
import stableService from './stable/stable.service.js'
import horseService from './horse/horse.service.js'

import syncService from './sync/sync.service.js'

export default function (app) {
   app.configure(stableService)
   app.configure(horseService)

   app.configure(syncService)
}

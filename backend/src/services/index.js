
import stableService from './stable/stable.service.js'
import horseService from './horse/horse.service.js'

export default function (app) {
   app.configure(stableService)
   app.configure(horseService)
}

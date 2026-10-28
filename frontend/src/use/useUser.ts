import createSqlModel from './createSqlModel'

const models = new WeakMap()

export default function(app) {
   if (!models.has(app)) models.set(app, createSqlModel(app, 'user'))
   return models.get(app)
}

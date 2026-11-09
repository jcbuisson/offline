import { Observable } from 'rxjs'
import { pgcouchConfig } from './pgcouchConfig'
import workerUrl from './pgcouch.worker.ts?sharedworker&url'

export function configureSharedPGCouch(app: any, onError: (error: unknown) => void, activity: any) {
   // New builds may overlap briefly with tabs using the previous worker script.
   // Share within a build; the stable database lock serializes different builds.
   const worker = new SharedWorker(workerUrl, { type: 'module', name: `${pgcouchConfig.worker}:${workerUrl}` })
   const port = worker.port
   const pending = new Map<string, { resolve(value: any): void, reject(error: unknown): void, finish(): void, method?: string }>()
   const observers = new Map<string, any>()
   let closed = false
   let failure: Error | undefined
   let connected = false
   const outgoing: any[] = []
   function send(message: any) {
      if (connected) port.postMessage(message)
      else outgoing.push(structuredClone(message))
   }
   let startupStage = 'starting-worker'
   const startupTimer = window.setTimeout(() => {
      const message = startupStage === 'waiting-lock'
         ? 'La préparation attend une autre session. Fermez les autres onglets de l’application, puis réessayez.'
         : 'La préparation des données prend trop de temps. Vérifiez votre connexion, puis réessayez.'
      fail(Object.assign(new Error(message), { code: 'startup-timeout' }))
   }, 60000)
   const asError = (value: any) => Object.assign(new Error(value.message), value)
   function track(kind: 'reads' | 'writes', model: string) {
      const counts = kind === 'reads' ? activity.modelReads : activity.modelWrites
      activity[kind]++; counts[model] = (counts[model] ?? 0) + 1
      let finished = false
      return () => {
         if (finished) return
         finished = true
         activity[kind]--; counts[model]--
      }
   }
   port.onmessage = ({ data }) => {
      if (failure || closed) return
      if (data.type === 'sync-state') {
         startupStage = data.stage ?? startupStage
         if (data.ready) window.clearTimeout(startupTimer)
         if (data.ready && !connected) {
            connected = true
            for (const message of outgoing.splice(0)) port.postMessage(message)
         }
         activity.initializing = !data.ready
         activity.syncing = data.syncing
         return
      }
      if (data.type === 'sync-error') {
         activity.initializing = false; activity.initialSync = false
         if (startupStage === 'failed') fail(asError(data.error))
         else onError(asError(data.error))
         return
      }
      if (data.type === 'value') { observers.get(data.id)?.next(data.value); return }
      if (data.type === 'subscription-error') { observers.get(data.id)?.error(asError(data.error)); return }
      const request = pending.get(data.id)
      if (!request) return
      pending.delete(data.id)
      request.finish()
      if (request.method === 'getStatus' && !data.error) activity.initialSync = !data.value.initialized && data.value.online
      if (data.error) request.reject(asError(data.error))
      else request.resolve(data.value)
   }
   function fail(error: Error) {
      if (failure || closed) return
      failure = error
      outgoing.length = 0
      window.clearTimeout(startupTimer)
      port.postMessage({ type: 'dispose' })
      port.close()
      onError(error)
      activity.initializing = false; activity.initialSync = false; activity.syncing = false
      for (const request of pending.values()) { request.finish(); request.reject(error) }
      pending.clear()
      for (const observer of observers.values()) observer.error(error)
      observers.clear()
   }
   worker.onerror = () => fail(new Error('Impossible de démarrer la base de données du navigateur.'))
   port.start()
   function request(type: string, extra: any = {}) {
      if (closed || failure) return Promise.reject(failure ?? new Error('Sync connection closed'))
      const id = crypto.randomUUID()
      const writing = type === 'transaction' || ['create', 'update', 'remove', 'delete'].includes(extra.method)
      const reading = ['findMany', 'findUnique', 'prepare'].includes(extra.method)
      const finish = writing || reading ? track(writing ? 'writes' : 'reads', extra.model ?? 'transaction') : () => {}
      return new Promise<any>((resolve, reject) => {
         pending.set(id, { resolve, reject, finish, method: extra.method })
         try { send({ type, id, ...extra }) }
         catch (error) { pending.delete(id); finish(); reject(error) }
      })
   }
   const cache = new Map()
   app.createPGCouchModel = (name: string) => {
      if (cache.has(name)) return cache.get(name)
      const model: any = {}
      for (const method of ['findMany', 'findUnique', 'create', 'update', 'remove', 'delete', 'prepare', 'getStatus', 'flushQueue', 'waitForIdle']) {
         model[method] = (...args: unknown[]) => request('call', { model: name, method, args })
      }
      model.start = () => request('network', { args: [true] })
      model.stop = () => { void request('network', { args: [false] }).catch(onError) }
      model.getObservable = (where = {}, options = {}) => new Observable(subscriber => {
         if (closed || failure) { subscriber.error(failure ?? new Error('Sync connection closed')); return }
         const id = crypto.randomUUID()
         const finish = track('reads', name)
         observers.set(id, {
            next(value: unknown) { finish(); subscriber.next(value) },
            error(error: unknown) { finish(); subscriber.error(error) },
            complete() { finish(); subscriber.complete() },
         })
         try { send({ type: 'subscribe', id, model: name, args: [where, options] }) }
         catch (error) { finish(); observers.delete(id); subscriber.error(error) }
         return () => { finish(); observers.delete(id); if (!closed && !failure) send({ type: 'unsubscribe', id }) }
      })
      cache.set(name, model)
      return model
   }
   app.pgcouchTransaction = (...args: unknown[]) => request('transaction', { args })
   app.disposePGCouchSync = async () => {
      if (closed) return
      closed = true
      outgoing.length = 0
      window.clearTimeout(startupTimer)
      window.removeEventListener('pagehide', release)
      port.postMessage({ type: 'dispose' })
      port.close()
      for (const request of pending.values()) { request.finish(); request.reject(new Error('Sync connection closed')) }
      pending.clear()
      for (const observer of observers.values()) observer.complete()
      observers.clear()
   }
   function release(event: PageTransitionEvent) {
      if (!event.persisted) void app.disposePGCouchSync()
   }
   window.addEventListener('pagehide', release)
}

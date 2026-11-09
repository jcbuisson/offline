import { Observable } from 'rxjs'

export function configureSharedPGCouch(app: any, onError: (error: unknown) => void) {
   const worker = new SharedWorker(new URL('./pgcouch.worker.ts', import.meta.url), { type: 'module', name: 'offline-pgcouch' })
   const port = worker.port
   const pending = new Map<string, { resolve(value: any): void, reject(error: unknown): void }>()
   const observers = new Map<string, any>()
   let closed = false
   const asError = (value: any) => Object.assign(new Error(value.message), value)
   port.onmessage = ({ data }) => {
      if (data.type === 'sync-error') { onError(asError(data.error)); return }
      if (data.type === 'value') { observers.get(data.id)?.next(data.value); return }
      if (data.type === 'subscription-error') { observers.get(data.id)?.error(asError(data.error)); return }
      const request = pending.get(data.id)
      if (!request) return
      pending.delete(data.id)
      if (data.error) request.reject(asError(data.error))
      else request.resolve(data.value)
   }
   worker.onerror = () => {
      const error = new Error('Unable to start shared browser database')
      onError(error)
      for (const request of pending.values()) request.reject(error)
      pending.clear()
      for (const observer of observers.values()) observer.error(error)
      observers.clear()
   }
   port.start()
   function request(type: string, extra: object = {}) {
      if (closed) return Promise.reject(new Error('Sync connection closed'))
      const id = crypto.randomUUID()
      return new Promise<any>((resolve, reject) => {
         pending.set(id, { resolve, reject })
         try { port.postMessage({ type, id, ...extra }) }
         catch (error) { pending.delete(id); reject(error) }
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
         if (closed) { subscriber.error(new Error('Sync connection closed')); return }
         const id = crypto.randomUUID()
         observers.set(id, subscriber)
         port.postMessage({ type: 'subscribe', id, model: name, args: [where, options] })
         return () => { observers.delete(id); if (!closed) port.postMessage({ type: 'unsubscribe', id }) }
      })
      cache.set(name, model)
      return model
   }
   app.pgcouchTransaction = (...args: unknown[]) => request('transaction', { args })
   app.disposePGCouchSync = async () => {
      if (closed) return
      closed = true
      window.removeEventListener('pagehide', release)
      port.postMessage({ type: 'dispose' })
      port.close()
      for (const request of pending.values()) request.reject(new Error('Sync connection closed'))
      pending.clear()
      for (const observer of observers.values()) observer.complete()
      observers.clear()
   }
   function release(event: PageTransitionEvent) {
      if (!event.persisted) void app.disposePGCouchSync()
   }
   window.addEventListener('pagehide', release)
}

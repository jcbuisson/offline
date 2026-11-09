import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// Let an activated update control existing tabs so they reload automatically.
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()))

// The app requests activation automatically after its current local saves.
self.addEventListener('message', (event) => {
   if (event.data && event.data.type === 'SKIP_WAITING')
      self.skipWaiting()
})

// cleanup outdated cached assets
cleanupOutdatedCaches()

// cache assets
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
   denylist: [/^\/couchdb(?:\/|$)/, /^\/electric\//, /^\/offline-socket-io\//],
}))

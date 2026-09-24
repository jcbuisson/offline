import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'

declare let self: ServiceWorkerGlobalScope

// prompt for new content
self.addEventListener('message', (event) => {
   if (event.data && event.data.type === 'SKIP_WAITING')
      self.skipWaiting()
})

// cleanup outdated cached assets
cleanupOutdatedCaches()

// cache assets
precacheAndRoute(self.__WB_MANIFEST)
registerRoute(new NavigationRoute(createHandlerBoundToURL('/index.html'), {
   denylist: [/^\/electric\//, /^\/offline-socket-io\//],
}))

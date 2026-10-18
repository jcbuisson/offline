import { io } from "socket.io-client";
import { createClient } from "@jcbuisson/express-x/client";
import { electricClientPlugin } from "@jcbuisson/express-x-plugins/electric-client";
import { reloadPlugin } from "@jcbuisson/express-x-plugins/reload-client";
import { ShapeStream } from '@electric-sql/client';

// Preserve 64-bit versions exactly while keeping local JSON rows serializable.
class SyncShapeStream extends ShapeStream {
   constructor(options) {
      super({ ...options, parser: { int8: value => value } });
   }
}


const socketOptions = {
   path: '/offline-socket-io/',
   transports: ["websocket"],
   reconnectionDelay: 1000,
   reconnectionDelayMax: 10000,
};

export const socket = io(socketOptions);

export const app = createClient(socket, { debug: true });

app.configure(reloadPlugin);

app.configure(electricClientPlugin, {
   sync: true,
   databaseName: 'offline-sync',
   ShapeStream: SyncShapeStream,
   onError: (error, { modelName }) => {
      if (navigator.onLine) console.error(`Electric sync failed for ${modelName}`, error);
   },
   shapePath: new URL(
      import.meta.env.VITE_ELECTRIC_URL || '/electric/v1/shape',
      window.location.origin,
   ).href,
});

// Keep all three datasets available offline, even before their screens are opened.
const syncModels = ['user', 'group', 'user_group_relation'].map(name =>
   app.createElectricModel(name, {
      primaryKey: 'uid',
      streamOptions: {
         // The owner must keep syncing for other tabs when its tab is hidden.
         runtimeVisibility: {
            getCurrentState: () => 'visible',
            subscribe: () => () => {},
         },
      },
   }),
);

function updateSyncNetwork() {
   for (const model of syncModels) {
      if (navigator.onLine) void model.start().catch(() => {});
      else model.stop();
   }
}

window.addEventListener('offline', updateSyncNetwork);
window.addEventListener('online', updateSyncNetwork);
updateSyncNetwork();

if (import.meta.hot) {
   import.meta.hot.dispose(() => {
      window.removeEventListener('offline', updateSyncNetwork);
      window.removeEventListener('online', updateSyncNetwork);
      void app.disposeElectricSync();
      socket.disconnect();
   });
}

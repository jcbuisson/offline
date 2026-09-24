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
   extraHeaders: {
      "bearer-token": "mytoken",
   },
};

export const socket = io(socketOptions);

export const app = createClient(socket, { debug: true });

app.configure(reloadPlugin);

app.configure(electricClientPlugin, {
   ShapeStream: SyncShapeStream,
   shapePath: new URL(
      import.meta.env.VITE_ELECTRIC_URL || '/electric/v1/shape',
      window.location.origin,
   ).href,
});

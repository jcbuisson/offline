import { io } from "socket.io-client";
import { createClient } from "@jcbuisson/express-x/client";
import { electricClientPlugin } from "@jcbuisson/express-x-plugins/electric-client";
import { reloadPlugin } from "@jcbuisson/express-x-plugins/reload-client";


const socketOptions = {
   path: '/offline-socket-io/',
   transports: ["websocket"],
   reconnectionDelay: 1000,
   reconnectionDelayMax: 10000,
   extraHeaders: {
      "bearer-token": "mytoken",
   },
};

const socket = io(socketOptions);

export const app = createClient(socket, { debug: true });

app.configure(reloadPlugin);

app.configure(electricClientPlugin, {
   shapePath: import.meta.env.VITE_ELECTRIC_URL
      || (import.meta.env.DEV
         ? 'http://localhost:3000/electric/v1/shape'
         : '/electric/v1/shape'),
});

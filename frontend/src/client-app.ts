import { io } from "socket.io-client";
// import { createClient, reloadPlugin, offlinePlugin } from "@jcbuisson/express-x-client";
import { createClient, reloadPlugin, offlinePlugin } from "/src/client.mts";


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

app.configure(offlinePlugin);

export const userModel = app.createOfflineModel('user', ['email']);
export const groupModel = app.createOfflineModel('group', ['name']);
export const userGroupRelationModel = app.createOfflineModel('user_group_relation', ['user_uid', 'group_uid']);

export function connect() {
   console.log('connecting...')
   socket.connect()
}

export function disconnect() {
   console.log('disconnecting...')
   socket.disconnect()
}
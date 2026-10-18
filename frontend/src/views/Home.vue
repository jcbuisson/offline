<template>
   <v-app class="app-shell overflow-hidden">

      <!-- makes the layout a vertical stack filling the full screen -->
      <div class="app-layout d-flex flex-column">
         <!-- Toolbar (does not grow) -->
         <v-toolbar class="flex-grow-0 flex-shrink-0">
            <v-toolbar-title text="Application offline-first, temps-réel, avec backend relationnel"></v-toolbar-title>
            <!-- <v-toolbar-title text="Why fetch when you can sync?"></v-toolbar-title> -->

            <template v-slot:append>
               <div class="d-flex ga-2">
                  <OnlineButton :isOnline="isConnected" @connect="connect" @disconnect="disconnect"></OnlineButton>
                  <GithubLink url="https://github.com/jcbuisson/offline" svgPath="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"></GithubLink>
               </div>
            </template>
         </v-toolbar>
         
         <!-- Tabsbar (does not grow) -->
         <v-tabs v-model="currentTab" class="flex-shrink-0">
            <v-tab text="Utilisateurs" value="users" @click="router.push('/users')"></v-tab>
            <v-tab text="Groupes" value="groups" @click="router.push('/groups')"></v-tab>
            <v-tab text="Explications" value="explanations" @click="router.push('/explanations')"></v-tab>
         </v-tabs>

         <!-- Fills remaining vertical space -->
         <div class="app-content d-flex flex-column flex-grow-1 overflow-hidden">
            <router-view />
         </div>

      </div>
   </v-app>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useRoute} from 'vue-router'

import GithubLink from '/src/components/GithubLink.vue'
import OnlineButton from '/src/components/OnlineButton.vue'

import router from '/src/router'

import { app, socket } from '/src/useExpressXClient.ts'

const isConnected = ref(socket.connected);

// Electric Shapes synchronize model subscriptions automatically.
app.addConnectListener(() => {
   isConnected.value = true
})

app.addDisconnectListener(() => {
   isConnected.value = false
})

function connect() {
   socket.connect();
}

function disconnect() {
   socket.disconnect();
}

const currentTab = ref('users')

const route = useRoute()
const routeRegex = /\/(users|groups|explanations)/

watch(() => [route.path], async () => {
   console.log('route.path', route.path)
   const match = route.path.match(routeRegex)
   if (!match) return
   const tab = match[1]
   currentTab.value = tab
}, { immediate: true })
</script>

<style scoped>
.app-shell {
   height: 100vh;
   height: 100dvh;
}

.app-shell :deep(.v-application__wrap) {
   height: 100%;
   min-height: 0;
}

.app-layout {
   flex: 1 1 0;
   min-height: 0;
   padding: env(safe-area-inset-top, 0px) env(safe-area-inset-right, 0px)
      env(safe-area-inset-bottom, 0px) env(safe-area-inset-left, 0px);
}

.app-content {
   min-height: 0;
}
</style>

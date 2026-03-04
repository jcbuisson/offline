<template>
   <v-app class="h-screen overflow-hidden">

      <!-- makes the layout a vertical stack filling the full screen -->
      <div class="d-flex flex-column fill-height">
         <!-- Toolbar (does not grow) -->
         <v-toolbar>
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
         <v-tabs v-model="currentTab">
            <v-tab text="Utilisateurs" value="users" @click="router.push('/users')"></v-tab>
            <v-tab text="Groupes" value="groups" @click="router.push('/groups')"></v-tab>
            <v-tab text="Explications" value="explanations" @click="router.push('/explanations')"></v-tab>
         </v-tabs>

         <!-- Fills remaining vertical space -->
         <div class="d-flex flex-column flex-grow-1 overflow-hidden">
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

import useUser from '/src/use/useUser';
import useGroup from '/src/use/useGroup';
import useUserGroupRelation from '/src/use/useUserGroupRelation';

import { app } from '/src/client-app.ts'

const { synchronizeAll: userSynchronizeAll } = useUser(app);
const { synchronizeAll: groupSynchronizeAll } = useGroup(app);
const { synchronizeAll: userGroupRelationSynchronizeAll } = useUserGroupRelation(app);

const isConnected = ref(false);

// synchronize when connection starts or restarts
// it is located here because of import circularity issues
app.addConnectListener(async () => {
   isConnected.value = true
   console.log(">>>>>>>>>>>>>>>> SYNC ALL")
   // order matters
   await userSynchronizeAll()
   await groupSynchronizeAll()
   await userGroupRelationSynchronizeAll()
})

app.addDisconnectListener(() => {
   isConnected.value = false
})

function connect() {
   app.connect();
}

function disconnect() {
   app.disconnect();
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

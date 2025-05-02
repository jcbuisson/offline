<template>
   <v-toolbar extended>
      <v-toolbar-title text="Application offline-first, temps-réel, avec backend relationnel"></v-toolbar-title>

      <template v-slot:append>
         <div class="d-flex ga-2">
            <v-btn size="small" @click="">Explications...</v-btn>
            <v-btn size="small" @click="clearCaches">Clear</v-btn>
            <OnlineButton :isOnline="isConnected" @connect="connect" @disconnect="disconnect"></OnlineButton>
            <GithubLink url="https://github.com/jcbuisson/offline" svgPath="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"></GithubLink>
         </div>
      </template>

      <template v-slot:extension>
         <v-tabs>
            <v-tab text="Utilisateurs" @click="router.push('/users')"></v-tab>
            <v-tab text="Groupes" @click="router.push('/groups')"></v-tab>
         </v-tabs>
      </template>
   </v-toolbar>

   <router-view></router-view>

   <ReloadPrompt></ReloadPrompt>
   
   <v-snackbar v-model="snackbar.visible" :timeout="snackbar.timeout" :color="snackbar.color">
      {{ snackbar.text }}
   </v-snackbar>

</template>

<script setup>
import { snackbar } from '/src/use/useSnackbar'

import ReloadPrompt from '/src/components/ReloadPrompt.vue'
import GithubLink from '/src/components/GithubLink.vue'
import OnlineButton from '/src/components/OnlineButton.vue'

import { isConnected, connect, disconnect } from '/src/client-app.js'

import { app } from '/src/client-app.js'
import router from '/src/router'

import { synchronizeAll as synchronizeAllUser, reset as resetUser } from '/src/use/useUser'
import { synchronizeAll as synchronizeAllGroup, reset as resetGroup } from '/src/use/useGroup'
import { synchronizeAll as synchronizeAllUserGroupRelation, reset as resetUserGroupRelation } from '/src/use/useUserGroupRelation'

// synchronize when connection starts or restarts
app.addConnectListener(async () => {
   console.log(">>>>>>>>>>>>>>>> SYNC ALL")
   // order matters
   await synchronizeAllUser()
   await synchronizeAllGroup()
   await synchronizeAllUserGroupRelation()
})

async function clearCaches() {
   await resetUser()
   await resetGroup()
   await resetUserGroupRelation()
}
</script>

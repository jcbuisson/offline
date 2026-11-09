<template>
   <ReloadPrompt></ReloadPrompt>

   <SyncStatus />
   <ActivityStatus />

   <router-view></router-view>

   <v-snackbar v-model="snackbar.visible" :timeout="snackbar.timeout" :color="snackbar.color">
      {{ snackbar.text }}
   </v-snackbar>

</template>

<script setup>
import { useObservable } from '@vueuse/rxjs'
import { allUsers$, allGroups$, allUserGroupRelations$ } from '/src/lib/businessObservables'

// Keep shared queries and replay buffers alive across tab changes. Vue releases
// these subscriptions when the app unmounts, including during hot reload.
for (const list$ of [allUsers$, allGroups$, allUserGroupRelations$]) {
   useObservable(list$, { onError: error => console.error('Failed to load shared list', error) })
}

import ReloadPrompt from '/src/components/ReloadPrompt.vue'
import SyncStatus from '/src/components/SyncStatus.vue'
import ActivityStatus from '/src/components/ActivityStatus.vue'
import { snackbar } from '/src/use/useSnackbar'
</script>

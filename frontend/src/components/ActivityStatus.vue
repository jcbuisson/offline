<template>
   <LoadingIndicator v-if="label" :label="label" />
</template>

<script setup>
import { computed } from 'vue'
import LoadingIndicator from './LoadingIndicator.vue'
import useExpressXClient from '/src/useExpressXClient'

const { state } = useExpressXClient()
const label = computed(() => {
   const activity = state.activity
   if (activity.initializing) return 'Préparation des données…'
   if (activity.writes) return 'Enregistrement…'
   if (activity.reads) return 'Chargement…'
   if (!state.syncErrors.pgcouch && activity.initialSync) return 'Chargement des données…'
   if (activity.syncing && !state.syncErrors.pgcouch) return 'Synchronisation…'
   return ''
})
</script>

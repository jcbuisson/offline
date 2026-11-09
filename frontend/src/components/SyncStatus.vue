<template>
   <v-alert v-if="syncError" type="warning" class="ma-2" role="alert">
      <template v-if="authenticationRequired">
         Connectez-vous à CouchDB pour charger les utilisateurs et les groupes.
         <a :href="signInUrl" target="_blank" rel="noopener noreferrer">Se connecter à CouchDB</a>.
         Revenez ensuite ici et rechargez la page.
      </template>
      <template v-else>
         La synchronisation a échoué : {{ syncError.message }}
      </template>
   </v-alert>
   <v-alert v-if="failures.length" type="error" class="ma-2" role="alert">
      Certaines modifications ne sont pas synchronisées avec le serveur.
      <div v-for="failure in failures" :key="failure.name">
         {{ failure.label }} : {{ failure.message }}
      </div>
      Les modifications refusées ont été annulées. Vous pouvez saisir une nouvelle modification.
   </v-alert>
</template>

<script setup>
import { computed, ref, onMounted, onUnmounted } from 'vue'
import useExpressXClient from '/src/useExpressXClient.ts'
import { pgcouchConfig } from '/src/pgcouchConfig'

const { app, state } = useExpressXClient()
const syncError = computed(() => state.syncErrors.pgcouch)
const authenticationRequired = computed(() => [401, 403].includes(syncError.value?.status))
const remoteUrl = new URL(pgcouchConfig.remote)
const signInUrl = new URL('./_utils/', remoteUrl).href
const failures = ref([])
const models = [{ name: 'pgcouch', label: 'Transactions', model: app.createPGCouchModel('user') }]
let timer
let disposed = false

async function refresh() {
   const results = await Promise.all(models.map(async ({ name, label, model }) => {
      try {
         const status = await model.getStatus()
         return status.failed > 0
            ? { name, label, message: `${status.failed} modification(s) refusée(s). ${status.error ?? ''}` }
            : null
      } catch (error) {
         return { name, label, message: error.message }
      }
   }))
   if (disposed) return
   failures.value = results.filter(Boolean)
   timer = setTimeout(refresh, 1000)
}

onMounted(refresh)
onUnmounted(() => {
   disposed = true
   clearTimeout(timer)
})
</script>

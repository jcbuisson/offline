<template>
   <v-alert v-if="failures.length" type="error" class="ma-2" role="alert">
      Certaines modifications ne sont pas synchronisées avec le serveur.
      <div v-for="failure in failures" :key="failure.name">
         {{ failure.label }} : {{ failure.message }}
      </div>
      Corrigez les données concernées pour relancer leur synchronisation.
   </v-alert>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import useExpressXClient from '/src/useExpressXClient.ts'

const { app } = useExpressXClient()
const failures = ref([])
const models = [
   ['user', 'Utilisateurs'],
   ['group', 'Groupes'],
   ['user_group_relation', 'Appartenances'],
].map(([name, label]) => ({ name, label, model: app.createElectricModel(name) }))
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

<template>

  <div v-if="needRefresh" class="fixed bottom-0 right-0 m-4 p-4 bg-green-100 border-solid rounded z-50">
      Une nouvelle version est disponible <a href="#" class="text-blue-400 hover:underline ml-2" @click="updateServiceWorker">installer</a>
   </div>

  <router-view></router-view>
  
</template>

<script setup>
import { useRegisterSW } from 'virtual:pwa-register/vue'

/////////////////      AUTOMATIC VERSION UPDATE     ////////////////

// POSSIBLE DE SIMPLIFIER AVEC registerType: 'autoUpdate'
// VOIR : https://vite-pwa-org.netlify.app/guide/auto-update.html

const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
   immediate: true,
   onRegistered(r) {
      console.log(`SW onRegistered: ${r}`)
      r && setInterval(async() => {
         console.log('Checking for sw update')
         await r.update()
         console.log('needRefresh', needRefresh.value)
         // if (needRefresh.value) {
         //    // update app
         //    console.log('updating app..!')
         //    updateServiceWorker()
         // }
      }, 20000 /* check every 20s */)
   },
})

</script>

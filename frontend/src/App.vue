<template>

  <div v-if="needRefresh" class="newversion">
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

<style scoped>
.newversion {
   position: fixed;
   bottom: 0px;
   right: 0px;
   margin: 1rem;
   padding: 1rem;
   background-color: #dcfce7;
   border-style: solid;
   border-radius: 0.25rem;
   border-color: #dcfce7;
   z-index: 50;
}
</style>
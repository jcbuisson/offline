<script setup lang="ts">
/// <reference types="vite-plugin-pwa/vue" />
import { useRegisterSW } from 'virtual:pwa-register/vue'

const { offlineReady, needRefresh, updateServiceWorker, } = useRegisterSW({
   onRegistered(r) {
      r && setInterval(() => {
         r.update()
      }, 10000)
   }
})
</script>

<template>
   <div v-if="offlineReady || needRefresh" class="pwatoast">
      <span v-if="offlineReady">
         L'application est prête à fonctionner hors-ligne
      </span>
      <span v-else>
         Une nouvelle version est disponible <a href="#" class="pwatoast-text" @click="updateServiceWorker">installer</a>
      </span>
   </div>
</template>

<style>
.pwatoast {
   position: fixed;
   bottom: 0px;
   right: 0px;
   margin: 1rem /* 16px */;
   padding: 1rem /* 16px */;
   background-color: #dcfce7;
   border-style: solid;
   border-radius: 0.25rem /* 4px */;
   border-color: #dcfce7;
   z-index: 50;
}
.pwatoast-text {
   color: #60a5fa;
   margin-left: 0.5rem /* 8px */;
}
.pwatoast-text:hover {
   text-decoration-line: underline;
}

</style>
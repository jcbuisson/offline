<template>

   <ReloadPrompt></ReloadPrompt>

   <router-view></router-view>
  
</template>

<script setup>
// see: https://vite-pwa-org.netlify.app/frameworks/vue.html
import ReloadPrompt from '/src/components/ReloadPrompt.vue'


// const { offlineReady, needRefresh, updateServiceWorker } = useRegisterSW({
//    immediate: true,
//    onRegistered(r) {
//       console.log(`SW onRegistered: ${r}`)
//       r && setInterval(async() => {
//          console.log('Checking for sw update')
//          await r.update()
//          console.log('needRefresh', needRefresh.value)
//          // if (needRefresh.value) {
//          //    // update app
//          //    console.log('updating app..!')
//          //    updateServiceWorker()
//          // }
//       }, 20000 /* check every 20s */)
//    },
// })

</script>

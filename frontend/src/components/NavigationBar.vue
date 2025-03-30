<template>
   <v-tabs bg-color="brown-darken-1" density="compact" slider-color="yellow"
         :model-value="currentTabIndex"
         @update:modelValue="onTabChange">
         
      <v-tabs-slider color="yellow"></v-tabs-slider>

      <v-tab :to="{path: tab.path}" router v-for="tab in tabs" :key="tab.uid">
         {{ tab.name }}
      </v-tab>
   </v-tabs>

</template>

<script setup>
import { computed } from 'vue'
import { useRoute } from 'vue-router'

import router from '/src/router'


const route = useRoute()

const tabs = [
   { uid: "a", name: "Utilisateurs", path: `/users` },
   { uid: "b", name: "Groupes", path: `/groups` },
]

const currentTabIndex = computed(() => {
   const tabIndex = tabs.findIndex(tab => route.path.startsWith(tab.path))
   return tabIndex
})

function onTabChange(tabIndex) {
   const tab = tabs[tabIndex]
   router.push(tab.path)
}
</script>

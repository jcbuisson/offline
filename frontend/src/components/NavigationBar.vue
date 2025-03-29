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
import { ref, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'

import router from '/src/router'

import { findMany } from '/src/use/useUser.js'


const props = defineProps({
   signedinUid: {
      type: String,
   },
})

const signedinUser = ref()

onMounted(async () => {
   const userObservable = await findMany({ uid: props.signedinUid })
   userObservable.subscribe(([user]) => signedinUser.value = user)
})

const route = useRoute()

const tabs = [
   { uid: "a", name: "Utilisateurs", path: `/home/users` },
   { uid: "b", name: "Groupes", path: `/home/groups` },
]

const currentTabIndex = computed(() => {
   const tabIndex = tabs.findIndex(tab => route.path.startsWith(tab.path))
   console.log('tabIndex', tabIndex)
   return tabIndex
})

function onTabChange(tabIndex) {
   extendExpiration()
   const tab = tabs[tabIndex]
   router.push(tab.path)
}
</script>

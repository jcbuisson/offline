<template>
   <SplitPanel>
      <template v-slot:left-panel>
         <v-card>
            <v-toolbar color="red-darken-4" density="compact">
               <v-btn readonly icon="mdi-magnify" variant="text"></v-btn>
               <v-text-field v-model="filter" single-line></v-text-field>
               <v-btn icon="mdi-plus" variant="text" @click="addGroup"></v-btn>
            </v-toolbar>
         
            <div :style="{ height: `calc(100vh - 160px)`, 'overflow-y': 'auto' }">
               <v-list-item three-line v-for="(group, index) in groupList":key="index" :value="group" @click="selectGroup(group)" :active="selectedGroup?.uid === group?.uid">
                  <v-list-item-title>{{ group.name }}</v-list-item-title>

                  <template v-slot:append>
                     <v-btn color="grey-lighten-1" icon="mdi-delete" variant="text" @click="deleteGroup(group)"></v-btn>
                  </template>
               </v-list-item>
            </div>
         </v-card>
      </template>

      <template v-slot:right-panel>
         <router-view></router-view>
      </template>
   </SplitPanel>
</template>


<script setup>
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useRoute} from 'vue-router'

import { findMany$ as findManyGroup$, remove as removeGroup } from '/src/use/useGroup'
import router from '/src/router'

import SplitPanel from '/src/components/SplitPanel.vue'


const filter = ref('')

const groupList = ref([])
const subscriptions = []

onMounted(async () => {
   const groupObservable = await findManyGroup$({})
   const groupSubscription = groupObservable.subscribe(async list => {
      groupList.value = list.toSorted((u1, u2) => (u1.name > u2.name) ? 1 : (u1.name < u2.name) ? -1 : 0)
   })
   subscriptions.push(groupSubscription)

   // enough to ensure that `group` objects are in cache
   await findManyGroup$({})
})

onUnmounted(() => {
   for (const subscription of subscriptions) {
      subscription.unsubscribe()
   }
})

async function addGroup() {
   router.push(`/groups/create`)
}

const selectedGroup = ref(null)

function selectGroup(group) {
   selectedGroup.value = group
   router.push(`/groups/${group.uid}`)
}

async function deleteGroup(group) {
   if (window.confirm(`Supprimer ${group.name} ?`)) {
      await removeGroup(group.uid)
      router.push(`/groups`)
   }
}

const route = useRoute()
const routeRegex = /\/groups\/([a-z0-9]+)/

watch(() => [route.path, groupList.value], async () => {
   const match = route.path.match(routeRegex)
   if (!match) return
   const group_uid = match[1]
   selectedGroup.value = groupList.value.find(group => group.uid === group_uid)
}, { immediate: true })
</script>

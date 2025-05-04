<template>
   <SplitPanel>
      <template v-slot:left-panel>
         <v-card>
            <v-toolbar color="red-darken-4" density="compact">
               <v-btn readonly icon="mdi-magnify" variant="text"></v-btn>
               <v-text-field v-model="filter" single-line></v-text-field>
               <v-btn icon="mdi-plus" variant="text" @click="addUser"></v-btn>
            </v-toolbar>
         
            <div :style="{ height: `calc(100vh - 160px)`, 'overflow-y': 'auto' }">
               <v-list-item three-line v-for="(user, index) in userList":key="index" :value="user" @click="selectUser(user)" :active="selectedUser?.uid === user?.uid">
                  <v-list-item-title>{{ user.lastname }} {{ user.firstname }}</v-list-item-title>
                  <v-list-item-subtitle>{{ user.email }}</v-list-item-subtitle>
                  <v-list-item-subtitle>
                     <template v-for="group in user.groups">
                        <v-chip size="x-small">{{ group?.name }}</v-chip>
                     </template>
                  </v-list-item-subtitle>

                  <template v-slot:append>
                     <v-btn color="grey-lighten-1" icon="mdi-delete" variant="text" @click="deleteUser(user)"></v-btn>
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
import { ref, onMounted, onUnmounted } from 'vue'

import { findMany$ as findManyUser$, getFullname, create as createUser, remove as removeUser } from '/src/use/useUser'
import { findMany$ as findManyGroup$, get as getGroup } from '/src/use/useGroup'
import { findMany$ as findManyUserGroupRelation$ } from '/src/use/useUserGroupRelation'
import router from '/src/router'
import { displaySnackbar } from '/src/use/useSnackbar'

import SplitPanel from '/src/components/SplitPanel.vue'


const filter = ref('')

const userList = ref([])
const subscriptions = []

onMounted(async () => {
   const userObservable = await findManyUser$({})
   const userSubscription = userObservable.subscribe(async list => {
      userList.value = list.toSorted((u1, u2) => (u1.lastname > u2.lastname) ? 1 : (u1.lastname < u2.lastname) ? -1 : 0)

      for (const user of userList.value) {
         const userGroupRelationObservable = await findManyUserGroupRelation$({ user_uid: user.uid })
         const groupRelationSubscription = userGroupRelationObservable.subscribe(async relationList => {
            user.groups = []
            for (const group_uid of relationList.map(relation => relation.group_uid)) {
               const group = await getGroup(group_uid)
               user.groups.push(group)
            }
         })
         subscriptions.push(groupRelationSubscription)
      }
   })
   subscriptions.push(userSubscription)

   // enough to ensure that `group` objects are in cache
   await findManyGroup$({})
})

onUnmounted(() => {
   for (const subscription of subscriptions) {
      subscription.unsubscribe()
   }
})

async function addUser() {
   router.push(`/users/create`)
}

const selectedUser = ref(null)

function selectUser(user) {
   selectedUser.value = user
   router.push(`/users/${user.uid}`)
}

async function deleteUser(user) {
   if (window.confirm(`Supprimer ${getFullname(user)} ?`)) {
      try {
         await removeUser(user.uid)
         router.push(`/users`)
         displaySnackbar({ text: "Suppression effectuée avec succès !", color: 'success', timeout: 2000 })
      } catch(err) {
         displaySnackbar({ text: "Erreur lors de la suppression...", color: 'error', timeout: 4000 })
      }
   }
}
</script>

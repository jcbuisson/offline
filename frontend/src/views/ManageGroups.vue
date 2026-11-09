<template>
   <SplitPanel>
      <template v-slot:left-panel>
         <!-- makes the layout a vertical stack filling the full height -->
         <v-card class="d-flex flex-column fill-height">
            <v-toolbar color="red-darken-4" density="compact">
               <v-btn readonly icon="mdi-magnify" variant="text"></v-btn>
               <v-text-field v-model="filter" single-line></v-text-field>
               <v-btn icon="mdi-plus" variant="text" @click="addGroup"></v-btn>
            </v-toolbar>
         
            <!-- fills remaining vertical space -->
            <div class="d-flex flex-column flex-grow-1 overflow-auto" :aria-busy="listLoading">
               <LoadingIndicator v-if="listLoading" label="Chargement des groupes…" />
               <v-list-item three-line v-for="group in sortedGroupList" :key="group.uid" :value="group" :to="`/groups/${group.uid}`" @click="selectedGroup = group" :active="selectedGroup?.uid === group.uid">
                  <v-list-item-title>{{ group.name }}</v-list-item-title>

                  <template v-slot:append>
                     <v-btn color="grey-lighten-1" icon="mdi-delete" variant="text" @click.stop.prevent="startDeletingGroup(group)"></v-btn>
                  </template>
               </v-list-item>
            </div>
         </v-card>
      </template>

      <template v-slot:right-panel>
         <router-view :key="$route.fullPath"></router-view>
      </template>
   </SplitPanel>

   <dialog ref="deletionDialog">
      <v-card>
         <v-card-title>Confirmer</v-card-title>
         <v-card-text>Supprimer le groupe {{groupToDelete?.name}} ? (nombre d'utilisateurs membres : {{userGroupRelations?.length}})</v-card-text>
         <LoadingIndicator v-if="relationsLoading" label="Chargement des membres…" />
         <v-card-actions>
            <v-btn @click="cancelDelete" :disabled="deleting">Annuler</v-btn>
            <v-btn @click="deleteGroup" :loading="deleting" :disabled="deleting || relationsLoading">Supprimer</v-btn>
         </v-card-actions>
      </v-card>
   </dialog>
</template>


<script setup>
import { allGroups$ } from '/src/lib/businessObservables'
import { ref, onUnmounted, watch, computed } from 'vue'
import { useRoute} from 'vue-router'
import { useObservable } from '@vueuse/rxjs'

import router from '/src/router'

import SplitPanel from '/src/components/SplitPanel.vue'
import LoadingIndicator from '/src/components/LoadingIndicator.vue'
import { displaySnackbar } from '/src/use/useSnackbar'

import useGroup from '/src/use/useGroup';
import useUserGroupRelation from '/src/use/useUserGroupRelation';

import useExpressXClient from '/src/useExpressXClient.ts'
const { app, state } = useExpressXClient();
const listLoading = computed(() => state.activity.initializing || (state.activity.initialSync && !state.syncErrors.pgcouch) || (state.activity.modelReads.group ?? 0) > 0)

const { remove: removeGroup } = useGroup(app);
const { getObservable: userGroupRelations$ } = useUserGroupRelation(app);



const filter = ref('')

const groupList = useObservable(allGroups$, {
   initialValue: [],
   onError: error => console.error('Failed to load groups from PGCouch', error),
})
const sortedGroupList = computed(() => {
   const query = (filter.value || '').toLowerCase()
   return (groupList.value ?? [])
      .filter(group => (group.name ?? '').toLowerCase().includes(query))
      .sort((u1, u2) => (u1.name > u2.name) ? 1 : (u1.name < u2.name) ? -1 : 0)
})

async function addGroup() {
   router.push(`/groups/create`)
}

const selectedGroup = ref(null)

function selectGroup(group) {
   selectedGroup.value = group
   router.push(`/groups/${group.uid}`)
}

const deletionDialog = ref(null)
const groupToDelete = ref()
const userGroupRelations = ref()
const deleting = ref(false)
const relationsLoading = ref(false)
let subscription

function startDeletingGroup(group) {
   groupToDelete.value = group
   if (subscription) subscription.unsubscribe()
   relationsLoading.value = true
   subscription = userGroupRelations$({ group_uid: group.uid }).subscribe({ next: relations => {
      relationsLoading.value = false
      // modal dialog will show the real-time count of group members
      userGroupRelations.value = relations
   }, error: error => { relationsLoading.value = false; console.error('Failed to load group members', error) } })
   deletionDialog.value.showModal()
}

function cancelDelete() {
   deletionDialog.value.close()
}

async function deleteGroup() {
   if (deleting.value) return
   deleting.value = true
   try {
      // The server atomically tombstones every membership, including unseen ones.
      await removeGroup(groupToDelete.value.uid)
      deletionDialog.value.close()
      router.push(`/groups`)
      displaySnackbar({ text: "Suppression effectuée avec succès !", color: 'success', timeout: 2000 })
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de la suppression...", color: 'error', timeout: 4000 })
   } finally {
      deleting.value = false
   }
}

onUnmounted(() => {
   if (subscription) subscription.unsubscribe()
})

const route = useRoute()
watch(() => [route.params.group_uid, groupList.value], () => {
   const group_uid = route.params.group_uid
   if (typeof group_uid !== 'string') return
   selectedGroup.value = groupList.value.find(group => group.uid === group_uid)
}, { immediate: true })
</script>

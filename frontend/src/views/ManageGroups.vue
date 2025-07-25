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
            <div class="d-flex flex-column flex-grow-1 overflow-auto">
               <v-list-item three-line v-for="(group, index) in sortedGroupList":key="index" :value="group" @click="selectGroup(group)" :active="selectedGroup?.uid === group?.uid">
                  <v-list-item-title>{{ group.name }}</v-list-item-title>

                  <template v-slot:append>
                     <v-btn color="grey-lighten-1" icon="mdi-delete" variant="text" @click="startDeletingGroup(group)"></v-btn>
                  </template>
               </v-list-item>
            </div>
         </v-card>
      </template>

      <template v-slot:right-panel>
         <router-view></router-view>
      </template>
   </SplitPanel>

   <dialog ref="confirmDialog">
      <v-card>
         <v-card-title>Confirmer</v-card-title>
         <v-card-text>Supprimer le groupe {{groupToDelete?.name}} ? (nombre d'utilisateurs membres : {{userGroupRelations?.length}})</v-card-text>
         <v-card-actions>
            <v-btn @click="cancelDelete">Annuler</v-btn>
            <v-btn @click="deleteGroup">Supprimer</v-btn>
         </v-card-actions>
      </v-card>
   </dialog>
</template>


<script setup>
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { useRoute} from 'vue-router'
import { Observable, from, map, of, merge, combineLatest, forkJoin, firstValueFrom } from 'rxjs'
import { mergeMap, switchMap, concatMap, scan, tap, catchError, take, debounceTime } from 'rxjs/operators'
import { useObservable } from '@vueuse/rxjs'

import { useGroup } from '/src/use/useGroup'
import { useUserGroupRelation } from '/src/use/useUserGroupRelation'
import router from '/src/router'

import SplitPanel from '/src/components/SplitPanel.vue'
import { displaySnackbar } from '/src/use/useSnackbar'

const { getObservable: groups$, remove: removeGroup } = useGroup()
const { getObservable: userGroupRelations$, remove: removeGroupRelation } = useUserGroupRelation()


const filter = ref('')

const groupList = useObservable(groups$({}), [])
const sortedGroupList = computed(() => groupList.value ? groupList.value.toSorted((u1, u2) => (u1.name > u2.name) ? 1 : (u1.name < u2.name) ? -1 : 0) : [])

const debouncedGroupRelations$ = (group_uid) => userGroupRelations$({ group_uid }).pipe(
   debounceTime(300) // wait until no new value for 300ms
)

async function addGroup() {
   router.push(`/groups/create`)
}

const selectedGroup = ref(null)

function selectGroup(group) {
   selectedGroup.value = group
   router.push(`/groups/${group.uid}`)
}

const confirmDialog = ref(null)
const groupToDelete = ref()
const userGroupRelations = ref()
let subscription

function startDeletingGroup(group) {
   groupToDelete.value = group
   if (subscription) subscription.unsubscribe()
   subscription = userGroupRelations$({ group_uid: group.uid }).subscribe(relations => {
      // modal dialog will show the real-time count of group members
      userGroupRelations.value = relations
   })
   userGroupRelations.value = []
   confirmDialog.value.showModal()
   // // TODO: find an async way to do it
   // const userGroupRelations = await firstValueFrom(debouncedGroupRelations$(group.uid))
   // if (window.confirm(`Supprimer le groupe ${group.name} ? (nombre d'utilisateurs membres : ${userGroupRelations.length})`)) {
   //    try {
   //       // remove user-group relations
   //       await Promise.all(userGroupRelations.map(relation => removeGroupRelation(relation.uid)))
   //       // remove group
   //       await removeGroup(group.uid)
   //       router.push(`/groups`)
   //       displaySnackbar({ text: "Suppression effectuée avec succès !", color: 'success', timeout: 2000 })
   //    } catch(err) {
   //       displaySnackbar({ text: "Erreur lors de la suppression...", color: 'error', timeout: 4000 })
   //    }
   // }
}
function cancelDelete() {
   confirmDialog.value.close()
}
async function deleteGroup() {
   confirmDialog.value.close()
   try {
      // remove user-group relations
      await Promise.all(userGroupRelations.value.map(relation => removeGroupRelation(relation.uid)))
      // remove group
      await removeGroup(groupToDelete.value.uid)
      router.push(`/groups`)
      displaySnackbar({ text: "Suppression effectuée avec succès !", color: 'success', timeout: 2000 })
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de la suppression...", color: 'error', timeout: 4000 })
   }
}

onUnmounted(() => {
   if (subscription) subscription.unsubscribe()
})

const route = useRoute()
const routeRegex = /\/groups\/([a-z0-9]+)/

watch(() => [route.path, groupList.value], async () => {
   if (!groupList.value) return
   const match = route.path.match(routeRegex)
   if (!match) return
   const group_uid = match[2]
   selectedGroup.value = groupList.value.find(group => group.uid === group_uid)
}, { immediate: true })
</script>

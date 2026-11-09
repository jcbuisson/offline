<template>
   <v-card>
      <LoadingIndicator v-if="loadingGroup" label="Chargement du groupe…" />
      <LoadingIndicator v-else-if="saving" label="Enregistrement…" />
      <v-form :disabled="loadingGroup">
         <v-container>
            <v-row>
               <v-col cols="12" md="6">
                  <v-text-field
                     label="Nom"
                     :modelValue="group?.name"
                     @input="(e) => onFieldInputDebounced('name', e.target.value)"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
            </v-row>
         </v-container>
      </v-form>
   </v-card>
</template>

<script setup>
import { ref, watch, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { map } from 'rxjs'

import { displaySnackbar } from '/src/use/useSnackbar'
import LoadingIndicator from '/src/components/LoadingIndicator.vue'

import useGroup from '/src/use/useGroup';

import useExpressXClient from '/src/useExpressXClient.ts'
const { app } = useExpressXClient();

const { getObservable: groups$, update: updateGroup } = useGroup(app);


const props = defineProps({
   group_uid: {
      type: String,
   },
})

const group = ref()
const loadingGroup = ref(true)
const saving = ref(false)
let draftVersion = 0

let groupSubscription

function group$(group_uid) {
   return groups$({}).pipe(
      map(groups => groups.find(group => group.uid === group_uid) ?? null)
   )
}

onUnmounted(() => {
   groupSubscription && groupSubscription.unsubscribe()
})

watch(() => props.group_uid, async (group_uid) => {
   if (groupSubscription) groupSubscription.unsubscribe()
   group.value = null
   loadingGroup.value = true
   groupSubscription = group$(group_uid).subscribe({ next: grp => {
      loadingGroup.value = false
      group.value = grp
   }, error: error => { loadingGroup.value = false; console.error('Failed to load group', error) } })
}, { immediate: true })


//////////////////////        TEXT FIELD EDITING        //////////////////////

const onFieldInput = async (field, value) => {
   try {
      await updateGroup(props.group_uid, { [field]: value })
      displaySnackbar({ text: "Modification effectuée avec succès !", color: 'success', timeout: 2000 })
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de la sauvegarde...", color: 'error', timeout: 4000 })
   }
}
const saveDebounced = useDebounceFn(async (uid, field, value, version) => {
   try {
      if (uid === props.group_uid) await onFieldInput(field, value)
   } finally {
      if (version === draftVersion) saving.value = false
   }
}, 500)
const onFieldInputDebounced = (field, value) => {
   saving.value = true
   void saveDebounced(props.group_uid, field, value, ++draftVersion)
}
</script>

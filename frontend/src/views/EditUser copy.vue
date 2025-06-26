<template>
   <v-card>
      <v-form>
         <v-container>
            <v-row>
               <v-col cols="12" sm="6">
                  <v-text-field
                     label="Email (unique)"
                     :modelValue="user?.email"
                     :rules="emailRules"
                     @input="(e) => onFieldInputDebounced('email', e.target.value)"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
            </v-row>
            <v-row>
               <v-col cols="12" sm="6">
                  <v-text-field
                     label="Nom"
                     :modelValue="user?.lastname"
                     @input="(e) => onFieldInputDebounced('lastname', e.target.value)"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
               <v-col cols="12" sm="6">
                  <v-text-field
                     label="Prénom"
                     :modelValue="user?.firstname"
                     @input="(e) => onFieldInputDebounced('firstname', e.target.value)"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
            </v-row>

            <v-row>
               <v-col xs="12" sm="12">
                  <v-select
                     variant="underlined"
                     v-model="userGroups"
                     @update:modelValue="onGroupChange"
                     :items="groupList"
                     item-title="name"
                     item-value="uid"
                     label="Groupes"
                     chips
                     multiple
                  ></v-select>
               </v-col>
            </v-row>

         </v-container>
      </v-form>
   </v-card>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'

import { addPerimeter as addUserPerimeter, update as updateUser } from '/src/use/useUser'
import { addPerimeter as addGroupPerimeter } from '/src/use/useGroup'
import { addPerimeter as addUserGroupRelationPerimeter, groupDifference, create as createUserGroupRelation, remove as removeUserGroupRelation } from '/src/use/useUserGroupRelation'
import { displaySnackbar } from '/src/use/useSnackbar'


const props = defineProps({
   user_uid: {
      type: String,
   },
})

const emailRules = [
   (v) => !!v || "L'email est obligatoire",
   (v) => /^([a-z0-9_.-]+)@([\da-z.-]+)\.([a-z.]{2,6})$/.test(v) || "l'email doit être valide"
]

const user = ref()

let groupListPerimeter
let userPerimeter
let groupRelationListPerimeter

onMounted(async () => {
   groupListPerimeter = await addGroupPerimeter({}, (list) => groupList.value = list)
})

onUnmounted(async () => {
   await groupListPerimeter.remove()
   userPerimeter && userPerimeter.remove()
   groupRelationListPerimeter && groupRelationListPerimeter.remove()
})

watch(() => props.user_uid, async (user_uid) => {
   if (userPerimeter) await userPerimeter.remove()
   userPerimeter = await addUserPerimeter({ uid: user_uid }, ([user_]) => {
      user.value = user_
   })
   if (groupRelationListPerimeter) await groupRelationListPerimeter.remove()
   groupRelationListPerimeter = await addUserGroupRelationPerimeter({ user_uid }, (relationList) => {
      userGroups.value = relationList.map(relation => relation.group_uid)
   })
}, { immediate: true })


//////////////////////        TEXT FIELD EDITING        //////////////////////

const onFieldInput = async (field, value) => {
   try {
      await updateUser(props.user_uid, { [field]: value })
      displaySnackbar({ text: "Modification effectuée avec succès !", color: 'success', timeout: 2000 })
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de l'enregistrement...", color: 'error', timeout: 4000 })
   }
}
const onFieldInputDebounced = useDebounceFn(onFieldInput, 500)


//////////////////////        USER-GROUP RELATIONS        //////////////////////

const userGroups = ref([])
const groupList = ref([])

const onGroupChange = async (groupUIDs) => {
   try {
      const [toAddGroupUIDs, toRemoveRelationUIDs] = await groupDifference(props.user_uid, groupUIDs)
      for (const group_uid of toAddGroupUIDs) {
         await createUserGroupRelation({ user_uid: props.user_uid, group_uid })
      }
      for (const relation_uid of toRemoveRelationUIDs) {
         await removeUserGroupRelation(relation_uid)
      }
      // await updateUserGroups(props.user_uid, groupUIDs)
      displaySnackbar({ text: "Modification effectuée avec succès !", color: 'success', timeout: 2000 })
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de l'enregistrement...", color: 'error', timeout: 4000 })
   }
}
</script>

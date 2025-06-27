<template>
   <v-card>
      <v-form>
         <v-container>
            <v-row>
               <v-col cols="12" md="3">
                  <v-text-field
                     label="email"
                     :modelValue="user?.email"
                     @input="(e) => onFieldInputDebounced('email', e.target.value)"
                     :rules="emailRules"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
            </v-row>

            <v-row>
               <v-col cols="12" md="6">
                  <v-text-field
                     label="Nom"
                     :modelValue="user?.lastname"
                     @input="(e) => onFieldInputDebounced('lastname', e.target.value)"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
               <v-col cols="12" md="6">
                  <v-text-field
                     label="Prénom"
                     :modelValue="user?.firstname"
                     @input="(e) => onFieldInputDebounced('firstname', e.target.value)"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
            </v-row>

            <v-row>
               <v-col xs="12" md="6">
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
import { ref, watch, onUnmounted } from 'vue'
import { useDebounceFn } from '@vueuse/core'
import { useObservable } from '@vueuse/rxjs'
import { firstValueFrom, map } from 'rxjs'

import { useUser } from '/src/use/useUser'
import { useGroup } from '/src/use/useGroup'
import { useUserGroupRelation } from '/src/use/useUserGroupRelation'

import { displaySnackbar } from '/src/use/useSnackbar'

const { getObservable: users$, update: updateUser } = useUser()
const { getObservable: groups$ } = useGroup()
const { getObservable: userGroupRelations$, groupDifference, create: createUserGroupRelation, remove: removeUserGroupRelation } = useUserGroupRelation()


const props = defineProps({
   user_uid: {
      type: String,
   },
})

const emailRules = [
   (v) => !!v || "L'email est obligatoire",
   (v) => /^([a-z0-9_.-]+)@([\da-z.-]+)\.([a-z.]{2,6})$/.test(v) || "l'email doit être valide"
]

const groupList = useObservable(groups$({}))

const user = ref()
const userGroups = ref([])
const userTabs = ref([])

let usersSubscription
let userGroupRelationSubscription
let userTabRelationSubscription

watch(() => props.user_uid, async (user_uid) => {
   
   // handle unsubscription carefully - otherwise, a previous subscription for another user_uid will interfere with current subscription
   if (usersSubscription) usersSubscription.unsubscribe()
   usersSubscription = users$({ uid: user_uid }).subscribe(userList => {
      if (userList.length === 0) return
      user.value = userList[0]
   })

   if (userGroupRelationSubscription) userGroupRelationSubscription.unsubscribe()
   userGroupRelationSubscription = userGroupRelations$({ user_uid }).pipe(
      map(relationList => relationList.map(relation => relation.group_uid))
   ).subscribe(groupUIDs => {
      userGroups.value = groupUIDs
   })
},
   { immediate: true } // so that it's called on component mount
)

onUnmounted(() => {
   if (usersSubscription) usersSubscription.unsubscribe()
   if (userGroupRelationSubscription) userGroupRelationSubscription.unsubscribe()
   if (userTabRelationSubscription) userTabRelationSubscription.unsubscribe()
})

//////////////////////        TEXT FIELD EDITING        //////////////////////

const onFieldInput = async (field, value) => {
   try {
      await updateUser(props.user_uid, { [field]: value })
      displaySnackbar({ text: "Modification effectuée avec succès !", color: 'success', timeout: 2000 })
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de la sauvegarde...", color: 'error', timeout: 4000 })
   }
}
const onFieldInputDebounced = useDebounceFn(onFieldInput, 500)


//////////////////////        USER-GROUP RELATIONS        //////////////////////

const onGroupChange = async (groupUIDs) => {
   try {
      const [toAddGroupUIDs, toRemoveRelationUIDs] = await groupDifference(props.user_uid, groupUIDs)
      for (const group_uid of toAddGroupUIDs) {
         await createUserGroupRelation({ user_uid: props.user_uid, group_uid })
      }
      for (const relation_uid of toRemoveRelationUIDs) {
         await removeUserGroupRelation(relation_uid)
      }
      displaySnackbar({ text: "Modification effectuée avec succès !", color: 'success', timeout: 2000 })
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de l'enregistrement...", color: 'error', timeout: 4000 })
   }
}
</script>

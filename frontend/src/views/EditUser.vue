<template>
   <v-card>
      <v-form>
         <v-container>
            <v-row>
               <v-col cols="12" md="3">
                  <v-text-field
                     label="email"
                     v-model="emailDraft"
                     @blur="saveEmail"
                     @keydown.enter.prevent="saveEmail"
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
                     @input="(e) => onFieldInput('lastname', e.target.value)"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
               <v-col cols="12" md="6">
                  <v-text-field
                     label="Prénom"
                     :modelValue="user?.firstname"
                     @input="(e) => onFieldInput('firstname', e.target.value)"
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
import { useObservable } from '@vueuse/rxjs'
import { map } from 'rxjs'

import { displaySnackbar } from '/src/use/useSnackbar'

import useUser from '/src/use/useUser';
import useGroup from '/src/use/useGroup';
import useUserGroupRelation from '/src/use/useUserGroupRelation';

import useExpressXClient from '/src/useExpressXClient.ts'
const { app } = useExpressXClient();

const { getObservable: users$, update: updateUser } = useUser(app);
const { getObservable: groups$ } = useGroup(app);
const { getObservable: userGroupRelations$, setGroups } = useUserGroupRelation(app);


const props = defineProps({
   user_uid: {
      type: String,
   },
})

const emailRules = [
   (v) => !!v || "L'email est obligatoire",
   (v) => /^([a-z0-9_.-]+)@([\da-z.-]+)\.([a-z.]{2,6})$/.test(v) || "l'email doit être valide"
]

const groupList = useObservable(groups$({}), { initialValue: [] })

const user = ref()
const emailDraft = ref('')
let emailDirty = false
watch(emailDraft, () => { emailDirty = emailDraft.value !== (user.value?.email ?? '') }, { flush: 'sync' })
const pendingGroupWrites = ref(0)
const userGroups = ref([])

let usersSubscription
let userGroupRelationSubscription
let userTabRelationSubscription

watch(() => props.user_uid, async (user_uid) => {
   // handle unsubscription carefully - otherwise, a previous subscription for another user_uid will interfere with current subscription
   if (usersSubscription) usersSubscription.unsubscribe()
   user.value = undefined
   usersSubscription = users$({}).subscribe(userList => {
      user.value = userList.find(candidate => candidate.uid === user_uid)
      if (!emailDirty) emailDraft.value = user.value?.email ?? ''
   })

   if (userGroupRelationSubscription) userGroupRelationSubscription.unsubscribe()
   userGroupRelationSubscription = userGroupRelations$({ user_uid }).pipe(
      map(relationList => relationList.map(relation => relation.group_uid))
   ).subscribe(groupUIDs => {
      if (!pendingGroupWrites.value) userGroups.value = groupUIDs
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

async function saveEmail() {
   if (emailRules.some(rule => rule(emailDraft.value) !== true)) return
   if (emailDraft.value === user.value?.email) return
   await onFieldInput('email', emailDraft.value)
}

const onFieldInput = async (field, value) => {
   try {
      await updateUser(props.user_uid, { [field]: value })
      if (field === 'email' && emailDraft.value === value) emailDirty = false
      displaySnackbar({ text: "Modification effectuée avec succès !", color: 'success', timeout: 2000 })
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de la sauvegarde...", color: 'error', timeout: 4000 })
   }
}


//////////////////////        USER-GROUP RELATIONS        //////////////////////

const onGroupChange = async (groupUIDs) => {
   const user_uid = props.user_uid
   pendingGroupWrites.value++
   try {
      await setGroups(user_uid, groupUIDs)
      displaySnackbar({ text: "Modification effectuée avec succès !", color: 'success', timeout: 2000 })
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de l'enregistrement...", color: 'error', timeout: 4000 })
   } finally {
      pendingGroupWrites.value--
      if (!pendingGroupWrites.value) {
         try {
            const relations = await useUserGroupRelation(app).findMany({ user_uid })
            if (!pendingGroupWrites.value && props.user_uid === user_uid) {
               userGroups.value = relations.map(relation => relation.group_uid)
            }
         } catch (error) { console.error('Failed to refresh memberships', error) }
      }
   }
}
</script>

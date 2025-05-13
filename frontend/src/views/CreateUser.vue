<template>
   <v-card>
      <v-form v-model="valid" lazy-validation>
         <v-container>
            <v-row>
               <v-col cols="12" sm="6">
                  <v-text-field
                     label="Email (unique)"
                     v-model="data.email"
                     :rules="emailRules"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
            </v-row>

            <v-row>
               <v-col cols="12" sm="6">
                  <v-text-field
                     label="Nom"
                     v-model="data.lastname"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
               <v-col cols="12" sm="6">
                  <v-text-field
                     label="Prénom"
                     v-model="data.firstname"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
            </v-row>

            <v-row>
               <v-col xs="12" sm="12">
                  <v-autocomplete
                     variant="underlined"
                     v-model="data.groups"
                     :items="groupList"
                     item-title="name"
                     item-value="uid"
                     label="Groupes"
                     chips
                     multiple
                  ></v-autocomplete>
               </v-col>
            </v-row>
         </v-container>
         <div class="submit-block">
            <v-btn @click="submit" :disabled="!valid" flat size="large" color="primary" style="min-width: 300px;;">Créer utilisateur</v-btn>
         </div>
      </v-form>
   </v-card>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { firstValueFrom } from 'rxjs'

import { findMany$ as findManyUser$, create as createUser } from '/src/use/useUser.js'
import { findMany$ as findManyGroup$ } from '/src/use/useGroup'
import { groupDifference, create as createUserGroupRelation, remove as removeUserGroupRelation } from '/src/use/useUserGroupRelation'

import router from '/src/router'
import { displaySnackbar } from '/src/use/useSnackbar'

const data = ref({})
const valid = ref()

const emailRules = [
   (v) => !!v || "L'email est obligatoire",
   (v) => /^([a-z0-9_.-]+)@([\da-z.-]+)\.([a-z.]{2,6})$/.test(v) || "l'email doit être valide"
]

const groupList = ref([])

onMounted(async () => {
   const groupListObservable = await findManyGroup$({})
   groupListObservable.subscribe(list => {
      groupList.value = list.toSorted((u1, u2) => (u1.name > u2.name) ? 1 : (u1.name < u2.name) ? -1 : 0)
   })
})

async function submit() {
   try {
      // check if email is not already used
      const [other] = await firstValueFrom(await findManyUser$({ email: data.value.email }))
      if (other) {
         alert(`Il existe déjà un utilisateur avec cet email : ${data.value.email}`)
      } else {
         const user = await createUser({
            email: data.value.email,
            firstname: data.value.firstname,
            lastname: data.value.lastname,
         })
         const [toAddGroupUIDs, toRemoveRelationUIDs] = await groupDifference(user.uid, data.value.groups || [])
         for (const group_uid of toAddGroupUIDs) {
            await createUserGroupRelation({ user_uid: user.uid, group_uid })
         }
         for (const relationUID of toRemoveRelationUIDs) {
            await removeUserGroupRelation(relationUID)
         }
         // await updateUserGroups(user.uid, data.value.groups || [])
         displaySnackbar({ text: "Création effectuée avec succès !", color: 'success', timeout: 2000 })
         router.push(`/users/${user.uid}`)
      }
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de la création...", color: 'error', timeout: 4000 })
   }
}
</script>

<style scoped>
.submit-block {
   display: flex;
   flex-direction: column;  
   align-items: center;
   padding: 20px;
}
</style>

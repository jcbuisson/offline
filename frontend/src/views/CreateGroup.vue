<template>
   <v-card>
      <v-form v-model="valid" lazy-validation>
         <v-container>
            <v-row>
               <v-col cols="12" sm="6">
                  <v-text-field
                     label="Nom"
                     v-model="data.name"
                     variant="underlined"
                  ></v-text-field>
               </v-col>
            </v-row>
         </v-container>
         <div class="submit-block">
            <v-btn @click="submit" :disabled="!valid" flat size="large" color="primary" style="min-width: 300px;;">Créer groupe</v-btn>
         </div>
      </v-form>
   </v-card>
</template>

<script setup>
import { ref } from 'vue'

import router from '/src/router'
import { displaySnackbar } from '/src/use/useSnackbar'

import { groupModel } from '/src/client-app.ts';

const { create: createGroup } = groupModel;

const data = ref({})

const valid = ref()

async function submit() {
   try {
      const group = await createGroup(data.value)
      displaySnackbar({ text: "Création effectuée avec succès !", color: 'success', timeout: 2000 })
      router.push(`/groups/${group.uid}`)
   } catch(err) {
      displaySnackbar({ text: "Erreur lors de la création...", color: 'error', timeout: 4000 })
   }
   router.back()
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
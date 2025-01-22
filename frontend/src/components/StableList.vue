<template>
   <div class="panel">

      <div class="subpanel">
         <form @submit.prevent="newStable">
            <div class="form-group">
               <div class="input-container">
                  <input type="text" name="addstable" v-model="formData.name" placeholder="Ex: Écurie Guillem" required>
               </div>
            </div>
            <div class="my-1">
               <button type="submit" class="large-button">Créer écurie</button>
            </div>
         </form>

         <ul class="styled-list" v-if="stableList.length">
            <li v-for="stable of stableList" key="stable.id">
               <router-link :to="`/stables/${stable.id}`">
                  {{ stable.name }}
               </router-link>
            </li>
         </ul>

         <h2 v-if="stableList.length === 0">Aucune écurie</h2>
      </div>

      <div class="subpanel">
         <router-view></router-view>
      </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue"
import { fetchStables, stableList, addStable, id2stable } from "/src/use/useStables"

const formData = ref({})

onMounted(async () => {
   await fetchStables()
})

async function newStable() {
   await addStable(formData.value)
   formData.value = {}
}

</script>

<style scoped>
</style>
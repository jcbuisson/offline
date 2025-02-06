<template>   
   <div>
      <form @submit.prevent="newHorse">
         <div class="form-group">
            <div class="input-container">
               <input type="text" name="addhorse" v-model="formData.name" placeholder="Ex: Donatello" required>
            </div>
         </div>
         <div class="my-1">
            <button type="submit" class="large-button">Créer écurie</button>
         </div>
      </form>

      <ul class="styled-list" v-if="horseList?.length">
         <li v-for="horse of horseList" key="horse.uid" :class="{ selected: horse.uid === selectedId}" @click="selectHorse(horse.uid)">
            {{ horse.name }}
         </li>
      </ul>

      <h2 v-if="!horseList?.length">Aucune écurie</h2>

   </div>

   <router-view></router-view>
</template>

<script setup>
import { ref, computed } from "vue"

import { addHorse, horseList } from "/src/use/useHorse"
import router from '/src/router'
import { onlineDate } from '/src/client-app.js'

const formData = ref({})
const selectedId = ref()


async function newHorse() {
   const dataCopy = Object.assign({}, formData.value)
   formData.value = {}
   /*await*/ addHorse(dataCopy)
}

function selectHorse(id) {
   selectedId.value = id
   router.push(`/horses/${id}`)
}
</script>

<style scoped>
.selected {
   background-color: #f0f0f0;
}

.styled-list {
  list-style: none; /* Remove default markers */
  background-color: #ffffff;
  padding: 0;       /* Remove default padding */
  margin: 0;        /* Remove default margin */
  margin-top: 40px;
  border: 1px solid #ccc; /* Optional: Add a border around the list */
  border-radius: 5px;     /* Optional: Rounded corners for the list */
  overflow: hidden;       /* Ensures inner items don't overflow */
}

.styled-list li {
  padding: 10px 15px;      /* Inner spacing */
  border-bottom: 1px solid #ccc; /* Thin separator line */
  text-align: center;      /* Center-align text */
}

.styled-list li:last-child {
  border-bottom: none; /* Remove bottom border for the last item */
}

/* Add hover effect */
.styled-list li:hover {
  background-color: #f0f0f0; /* Highlight item on hover */
  cursor: pointer;
}
</style>
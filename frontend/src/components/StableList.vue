<template>

   <GithubLink url="https://github.com/jcbuisson/offline" svgPath="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"></GithubLink>

   <OnlineStatus></OnlineStatus>

   <!-- version -->
   <div class="version">
      v2.9
   </div>
   

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

         <ul class="styled-list" v-if="stableList?.length">
            <li v-for="stable of stableList" key="stable.uid" :class="{ selected: stable.uid === selectedId}" @click="selectStable(stable.uid)">
               {{ stable.name }}
            </li>
         </ul>

         <h2 v-else">Aucune écurie</h2>

      </div>

      <div class="subpanel">
         <router-view></router-view>
      </div>
   </div>
</template>

<script setup>
import { ref } from "vue"

import { addStable, stableList } from "/src/use/useStable"
import router from '/src/router'
import { onlineDate, offlineDate } from '/src/client-app.js'

import GithubLink from "/src/components/GithubLink.vue"
import OnlineStatus from "/src/components/OnlineStatus.vue"

const formData = ref({})

const selectedId = ref()


async function newStable() {
   const dataCopy = Object.assign({}, formData.value)
   formData.value = {}
   /*await*/ addStable(dataCopy)
}

function selectStable(id) {
   selectedId.value = id
   router.push(`/stables/${id}`)
}
</script>

<style scoped>
.panel {
  display: flex;
  width: 100%;
}

.subpanel {
  flex: 1; /* Each subpanel takes equal space */
  padding: 20px;
}

 /* Thin vertical line */
 .subpanel:not(:last-child) {
  border-right: 1px solid #ccc;
}

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

.version {
  color: rgb(97, 110, 137);
  position: absolute;
  top: 1rem;
  left: 1rem;
}
</style>
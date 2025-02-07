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

      <ul class="styled-list" v-if="horseList_?.length">
         <li v-for="horse of horseList" key="horse.uid" :class="{ selected: horse.uid === selectedUid}" @click="selectHorse(horse.uid)">
            {{ horse.name }}
         </li>
      </ul>

      <h2 v-if="!horseList_?.length">Aucun cheval</h2>

   </div>

   <router-view></router-view>
</template>

<script setup>
import { ref, watch } from "vue"

import { addHorse, getHorseList } from "/src/use/useHorse"
import router from '/src/router'


const props = defineProps({
   stable_uid: String,
})

const formData = ref({})
const selectedUid = ref()

const horseList = ref()
watch(() => props.uid, async (newValue, oldValue) => {
   horseList.value = await getHorseList(props.stable_uid)
}, { immediate: true })


async function newHorse() {
   const dataCopy = Object.assign({}, formData.value)
   formData.value = {}
   await addHorse(dataCopy)
}

function selectHorse(uid) {
   selectedUid.value = uid
   router.push(`/horses/${uid}`)
}
</script>

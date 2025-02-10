<template>   
   <div>
      <form @submit.prevent="createHorse">
         <div class="form-group">
            <div class="input-container">
               <input type="text" name="addhorse" v-model="formData.name" placeholder="Ex: Donatello" required>
            </div>
         </div>
         <div class="my-1">
            <button type="submit" class="large-button">Créer cheval</button>
         </div>
      </form>

      <ul class="styled-list" v-if="horseList?.length">
         <li v-for="horse of horseList" key="horse.uid" :class="{ selected: horse.uid === selectedUid}" @click="selectHorse(horse.uid)">
            {{ horse.name }}
         </li>
      </ul>

      <h2 v-if="!horseList?.length">Aucun cheval</h2>

   </div>

   <router-view></router-view>
</template>

<script setup>
import { ref, watch } from "vue"

import { addHorse, getStableHorses } from "/src/use/useHorse"
import router from '/src/router'


const props = defineProps({
   stable_uid: String,
})

const formData = ref({})
const selectedUid = ref()

const horseList = ref()
watch(() => props.stable_uid, async (newValue, oldValue) => {
   horseList.value = await getStableHorses(props.stable_uid)
}, { immediate: true })


async function createHorse() {
   const dataCopy = Object.assign({}, formData.value)
   formData.value = {}
   await addHorse(props.stable_uid, dataCopy)
}

function selectHorse(horse_uid) {
   selectedUid.value = horse_uid
   router.push(`/stables/${props.stable_uid}/horses/${horse_uid}`)
}
</script>

<template>

   <div>
      <form @submit.prevent="updateStable">
         <div class="form-group my-1">
            <label for="uid">uid</label>
            <div class="input-container">
               <input type="text" name="uid" :value="stable_uid" disabled>
            </div>
         </div>
         <div class="form-group my-1">
            <label for="name">name</label>
            <div class="input-container">
               <input type="text" name="name" :value="stable?.name" @change="(evt) => formData.name = evt.target.value" required>
            </div>
         </div>
         <div class="my-1">
            <button type="submit" class="large-button">Mettre à jour écurie</button>
         </div>
      </form>
      <div class="my-1">
         <button class="large-red-button" @click="removeStable">Supprimer écurie</button>
      </div>
   </div>

   <router-view></router-view>
</template>

<script setup>
import { ref, watch } from "vue"

import { getStable, patchStable, deleteStable } from "/src/use/useStable"
import router from "/src/router"

const props = defineProps({
   stable_uid: String,
})

const formData = ref({})


const stable = ref()
watch(() => props.stable_uid, async (newValue, oldValue) => {
   stable.value = await getStable(props.stable_uid)
}, { immediate: true })



async function updateStable() {
   await patchStable(props.stable_uid, formData.value)
}

async function removeStable() {
   await deleteStable(props.stable_uid)
   router.push("/stables")
}
</script>

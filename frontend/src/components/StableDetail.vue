<template>

   <div>
      <form @submit.prevent="updateStable">
         <div class="form-group my-1">
            <label for="id">Id</label>
            <div class="input-container">
               <input type="text" name="id" :value="id" disabled>
            </div>
         </div>
         <div class="form-group my-1">
            <label for="name">Name</label>
            <div class="input-container">
               <input type="text" name="name" :value="stable?.name" @change="(evt) => formData.name = evt.target.value" required>
            </div>
         </div>
         <div class="my-1">
            <button type="submit" class="large-button">Mettre à jour</button>
         </div>
      </form>
      <div class="my-1">
         <button class="large-red-button" @click="removeStable">Supprimer</button>
      </div>
   </div>
</template>

<script setup>
import { computed, ref } from "vue"
import { stableFromId, patchStable, deleteStable } from "/src/use/useStable"
import router from "/src/router"

const props = defineProps({
   id: String,
})

const formData = ref({})

const stable = computed(() => stableFromId.value(props.id))

async function updateStable() {
   await patchStable(props.id, formData.value)
}

async function removeStable() {
   // do not await when offline
   /* await */ deleteStable(props.id)
   router.push("/stables")
}
</script>

<template>

   <div>{{ stable }}
      <form @submit.prevent="updateStable">
         <div class="form-group my-1">
            <label for="uid">uid</label>
            <div class="input-container">
               <input type="text" name="uid" :value="uid" disabled>
            </div>
         </div>
         <div class="form-group my-1">
            <label for="name">name</label>
            <div class="input-container">
               <input type="text" name="name" :value="stable.name" @change="(evt) => formData.name = evt.target.value" required>
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
import { computed, ref, onUpdated } from "vue"
import { stableFromId, getStable, patchStable, deleteStable } from "/src/use/useStable"
import router from "/src/router"

const props = defineProps({
   uid: String,
})

const formData = ref({})

const stable = computed(() => stableFromId.value(props.uid))

async function updateStable() {
   await patchStable(props.id, formData.value)
}

async function removeStable() {
   // do not await when offline
   /* await */ deleteStable(props.uid)
   router.push("/stables")
}
</script>

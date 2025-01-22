<template>

   <div v-if="stable">
      <form @submit.prevent="updateStable">
         <div class="form-group my-1">
            <label for="id">Id</label>
            <div class="input-container">
               <input type="text" name="id" :value="formData.id" readonly>
            </div>
         </div>
         <div class="form-group my-1">
            <label for="name">Name</label>
            <div class="input-container">
               <input type="text" name="name" v-model="formData.name" required>
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
import { computed, ref, onMounted } from "vue"
import { getStable, stableFromId, deleteStable } from "/src/use/useStables"
import router from "/src/router"

const props = defineProps({
   id: String,
})

onMounted(async () => {
   formData.value = await getStable(props.id)
})

const formData = ref({})

const stable = computed(() => stableFromId.value(props.id))

async function updateStable() {
}

async function removeStable() {
   await deleteStable(stable.value.id)
   router.push("/stables")
}
</script>

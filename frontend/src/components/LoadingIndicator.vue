<template>
   <div class="d-flex align-center justify-center ga-3 pa-4" role="status" aria-live="polite">
      <v-progress-circular indeterminate :size="24" :width="3" color="primary" aria-hidden="true" />
      <span>{{ label }}</span>
   </div>
</template>

<script setup>
defineProps({ label: { type: String, default: 'Chargement…' } })
</script>

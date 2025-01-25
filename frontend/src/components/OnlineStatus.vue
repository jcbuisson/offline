<template>
   <div class="offline" :class="{ on: isOnline, off: !isOnline }">
      {{ isOnline ? "ON-LINE" : "OFF-LINE" }}
   </div>
</template>


<script setup>
import { useOnline } from '@vueuse/core'

const isOnline = useOnline()
</script>


<style scoped>
.offline {
  padding: 5px;
  font-size: 14px;
  width: 80px;
  height: 15px;
  position: absolute;
  top: 1rem;
  right: 6rem;
  border-style: solid;
  border-radius: 10px;
  border-width: 0;
  text-align: center;
}

.off {
  color: white;
  background-color: rgb(236, 139, 139);
}
.on {
  color: white;
  background-color: #54daa0;
}
</style>

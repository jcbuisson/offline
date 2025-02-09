<template>

   <ReloadPrompt></ReloadPrompt>

   <D3Graph @stableSelect="stableSelect"></D3Graph>

   <button class="mybutton" @click="fetchAllStables">All stables</button>
   <button class="mybutton">All horses</button>
  
</template>

<script setup>
import { ref, computed } from "vue"

import { addStable, stableList } from "/src/use/useStable"

import ReloadPrompt from '/src/components/ReloadPrompt.vue'
import D3Graph from "/src/components/D3Graph.vue"

function fetchAllStables() {
   
}

function stableSelect(stable) {
   console.log('stable', stable)
}
</script>

<style>
.mybutton {
   padding: 8px 12px;
   background: #044c408a;
   color: white;
   border: none;
   cursor: pointer;
   border-radius: 5px;
   margin-left: 5px;
   margin-right: 5px;
}
.mybutton:hover {
   background: #555;
}
</style>
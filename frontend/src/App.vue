<template>

   <ReloadPrompt></ReloadPrompt>

   <D3Graph @select="onSelect"></D3Graph>

   <button class="mybutton" @click="fetchAllStables">All stables</button>
   <button class="mybutton" @click="fetchStableA">Stable 'a'</button>
   <button class="mybutton" @click="fetchAllHorses">All horses</button>
  
</template>

<script setup>
import { ref, computed } from "vue"

import { addStableSynchro } from "/src/use/useStable"
import { addHorseSynchro } from "/src/use/useHorse"

import ReloadPrompt from '/src/components/ReloadPrompt.vue'
import D3Graph from "/src/components/D3Graph.vue"

function fetchAllStables() {
   addStableSynchro({})
}

function fetchAllHorses() {
   addHorseSynchro({})
}

function fetchStableA() {
   addStableSynchro({ name: 'a' })
}

function onSelect(node) {
   console.log('node', node)
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
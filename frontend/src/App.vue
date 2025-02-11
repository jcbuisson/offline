<template>

   <ReloadPrompt></ReloadPrompt>

   <D3Graph @select="onSelect"></D3Graph>

   <button class="mybutton" @click="fetchAllStables">All stables</button>
   <button class="mybutton" @click="newStable">Add stable</button>
   <button class="mybutton" @click="fetchAllHorses">All horses</button>
  
</template>

<script setup>
import { ref, computed } from "vue"

import { addStableSynchro, addStable } from "/src/use/useStable"
import { addHorseSynchro } from "/src/use/useHorse"

import ReloadPrompt from '/src/components/ReloadPrompt.vue'
import D3Graph from "/src/components/D3Graph.vue"

function fetchAllStables() {
   addStableSynchro({})
}

function fetchAllHorses() {
   addHorseSynchro({})
}

async function newStable() {
   await addStable({ name: 'tochange' })
}

function onSelect(node) {
   console.log('node', node)
   if (node.type === 'stable') {
      addHorseSynchro({ stable_uid: node.uid })
   }
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
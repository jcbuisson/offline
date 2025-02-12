<template>
   <ReloadPrompt></ReloadPrompt>

   <h1>Offline-first, realtime web applications with relational database backend</h1>

   <h2>Cache contents</h2>
   <!-- <D3Graph @select="onSelect"></D3Graph> -->
   <!-- <div>Stables : {{ stableList }}</div>
   <div>Horses : {{ horseList }}</div> -->
   <SimpleGraph2 @select="onSelect" />
   <!-- <SimpleGraph /> -->


   <button class="mybutton" @click="fetchAllStables">All stables</button>
   <button class="mybutton" @click="newStable">Add stable</button>
   <button class="mybutton" @click="fetchAllHorses">All horses</button>

   <div style="border-style: dotted;" v-if="selectedNode?.type === 'stable'">
      <p>Stable {{ selectedNode.uid }}</p>
      <input :value="selectedNode.name" @change="e => updateStable(e.target.value)"/>
      <button class="mybutton" @click="newHorse">Add horse</button>
   </div>

   <div style="border-style: dotted;" v-if="selectedNode?.type === 'horse'">
      <p>Horse {{ selectedNode.uid }}</p>
      <input :value="selectedNode.name" @change="e => updateHorse(e.target.value)"/>
   </div>
  
   <h2>Explanations</h2>
   <p>
      The client reads and writes in denormalized caches, one for each model. These caches are the client's source of truth,
      from which it derives all its information.
      
      The client also gives synchronization directives on model subsets, so that:
      1- the contents of caches on these subsets are saved on database server
      2- client's cache and server table keep being synchronized from that moment on these subsets
   </p>
   <p>
      For example if synchronization directive (horse, { stable_id: 'azer' }) is executed, the cache will contain all horses from stable 'azer',
      from that moment, even if other clients add, delete or update the set of horses from stable 'azer'
   </p>

</template>

<script setup>
import { ref, computed } from "vue"

import { addStableSynchro, addStable, patchStable, stableList } from "/src/use/useStable"
import { addHorseSynchro, addHorse, patchHorse, horseList } from "/src/use/useHorse"

import ReloadPrompt from '/src/components/ReloadPrompt.vue'
// import D3Graph from "/src/components/D3Graph.vue"
import SimpleGraph2 from "/src/components/SimpleGraph2.vue"
// import SimpleGraph from "/src/components/SimpleGraph.vue"

const selectedNode = ref()

function fetchAllStables() {
   addStableSynchro({})
}

function fetchAllHorses() {
   addHorseSynchro({})
}

async function newStable() {
   await addStable({ name: 'tochange' })
}

async function onSelect(node) {
   selectedNode.value = node
   console.log('node', node)
   if (node.type === 'stable') {
      await addHorseSynchro({ stable_uid: node.uid })
   }
}

async function newHorse() {
   await addHorse(selectedNode.value.uid, { name: 'tochange' })
}

async function updateStable(name) {
   console.log('update', name)
   await patchStable(selectedNode.value.uid, { name })
}

async function updateHorse(name) {
   console.log('update', name)
   await patchHorse(selectedNode.value.uid, { name })
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
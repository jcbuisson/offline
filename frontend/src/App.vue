<template>
   <ReloadPrompt></ReloadPrompt>
   <GithubLink url="https://github.com/jcbuisson/offline" svgPath="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"></GithubLink>
   <OnlineStatus :isOnline="isOnline"></OnlineStatus>

   <h1>Offline-first webapps</h1>
   <p>Offline-first, realtime web applications with relational database backend</p>

   <v-btn size="small" @click="fetchAllStables">All stables</v-btn>
   <button class="mybutton" @click="newStable">Add stable</button>
   <button class="mybutton" @click="fetchAllHorses">All horses</button>
   <button class="mybutton" @click="sync">Sync</button>
   <button class="mybutton" @click="disconnect">Disconnect</button>

   <h2>Cache contents</h2>
   <SimpleGraph @select="onSelect" />

   <div v-if="selectedNode?.type === 'stable'">
      <p>Stable {{ selectedNode.uid }}</p>
      <input :value="selectedNode.name" @change="e => updateStable(e.target.value)"/>
      <button class="mybutton" @click="newHorse">Add horse</button>
      <button class="mybutton" @click="delStable">Delete stable</button>
   </div>

   <div v-if="selectedNode?.type === 'horse'">
      <p>Horse {{ selectedNode.uid }}</p>
      <input :value="selectedNode.name" @change="e => updateHorse(e.target.value)"/>
      <button class="mybutton" @click="delHorse">Delete horse</button>
   </div>

   <div>
      <div><v-btn size="small" @click="getDatabaseData">Database data</v-btn></div>
      <v-data-table :items="databaseStables" density="compact" hide-default-footer></v-data-table>
      <v-data-table :items="databaseHorses" density="compact" hide-default-footer></v-data-table>
   </div>

   <div>
      <div><v-btn size="small" @click="getLocalData">Local data</v-btn></div>
      <v-data-table :items="localStables" density="compact" hide-default-footer></v-data-table>
      <v-data-table :items="localHorses" density="compact" hide-default-footer></v-data-table>
   </div>
  

</template>

<script setup>
import { ref, computed } from "vue"
import { format } from 'date-fns'

import { addStableSynchro, addStable, patchStable, deleteStable } from "/src/use/useStable"
import { addHorseSynchro, addHorse, patchHorse, deleteHorse } from "/src/use/useHorse"
import { onlineDate } from '/src/client-app.js'

import { db as stableDB } from '/src/use/useStable.js'
import { db as horseDB } from '/src/use/useHorse.js'
import { synchronizeAll } from '/src/lib/synchronize.js'

import { app, offlineDate, socket } from '/src/client-app.js'

import ReloadPrompt from '/src/components/ReloadPrompt.vue'
import GithubLink from '/src/components/GithubLink.vue'
import OnlineStatus from '/src/components/OnlineStatus.vue'
import SimpleGraph from "/src/components/SimpleGraph.vue"

const isOnline = computed(() => !!onlineDate.value)
const selectedNode = ref()
const databaseStables = ref()
const databaseHorses = ref()
const localStables = ref()
const localHorses = ref()


function formatStable(stable) {
   return {
      name: stable.name,
      uid: stable.uid.substring(0, 8),
      created: format(new Date(stable.createdAt), 'dd/MM/yyyy HH:mm:ss'),
      updated: format(new Date(stable.updatedAt), 'dd/MM/yyyy HH:mm:ss'),
   }
}

function formatHorse(horse) {
   return {
      name: horse.name,
      uid: horse.uid.substring(0, 8),
      stable_uid: horse.stable_uid.substring(0, 8),
      created: format(new Date(horse.createdAt), 'dd/MM/yyyy HH:mm:ss'),
      updated: format(new Date(horse.updatedAt), 'dd/MM/yyyy HH:mm:ss'),
   }
}

async function getDatabaseData() {
   databaseStables.value = (await app.service('stable').findMany({})).map(formatStable)
   databaseHorses.value = (await app.service('horse').findMany({})).map(formatHorse)
}

async function getLocalData() {
   localStables.value = (await stableDB.stables.toArray()).map(formatStable)
   localHorses.value = (await horseDB.horses.toArray()).map(formatHorse)
}

function fetchAllStables() {
   addStableSynchro({})
}

function fetchAllHorses() {
   addHorseSynchro({})
}

async function sync() {
   console.log('sync...')
   await synchronizeAll(app, 'stable', stableDB.stables, offlineDate.value, stableDB.whereList)
   await synchronizeAll(app, 'horse', horseDB.horses, offlineDate.value, horseDB.whereList)
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
   await patchStable(selectedNode.value.uid, { name })
}

async function updateHorse(name) {
   await patchHorse(selectedNode.value.uid, { name })
}

async function delStable() {
   await deleteStable(selectedNode.value.uid)
   selectedNode.value = null
}

async function delHorse() {
   await deleteHorse(selectedNode.value.uid)
   selectedNode.value = null
}

function disconnect() {
   socket.disconnect()
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
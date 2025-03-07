<template>
   <ReloadPrompt></ReloadPrompt>
   <GithubLink url="https://github.com/jcbuisson/offline" svgPath="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"></GithubLink>
   <OnlineStatus :isOnline="isOnline"></OnlineStatus>

   <h1>Offline-first webapps</h1>
   <p>Offline-first, realtime web applications with relational database backend</p>

   <v-text-field style="max-width: 150px;" type="text" variant="underlined" density="compact" ref="userTF"
      v-model="userName" @input="ev => debouncedChangeUserName(ev.target.value)"
      :append-inner-icon="!selectedUserNode && 'mdi-plus'"
      :append-icon="selectedUserNode && 'mdi-delete'"
      label="user"
      @click:append-inner="onAddEditUser"
      @click:append="onDeleteUser"
   ></v-text-field>

   <v-text-field style="max-width: 150px;" type="text" variant="underlined" density="compact" ref="groupTF"
      v-model="groupName"
      :append-inner-icon="selectedGroupNode ? 'mdi-pencil' : 'mdi-plus'"
      :append-icon="selectedGroupNode && 'mdi-delete'"
      label="group"
      @click:append-inner="onAddEditGroup"
      @click:append="onDeleteGroup"
   ></v-text-field>

   <v-text-field style="max-width: 150px;" type="text" variant="underlined" density="compact"
      v-model="searchUser"
      append-inner-icon="mdi-magnify"
      label="search user"
      @click:append-inner="onSearchUser"
   ></v-text-field>

   <!--RelationGraph></RelationGraph-->
   <div ref="svgContainer" class="graph-container"></div>


   <!-- <v-btn size="small" @click="fetchAllStables">All stables</v-btn>
   <button class="mybutton" @click="newStable">Add stable</button>
   <button class="mybutton" @click="fetchAllHorses">All horses</button>
   <button class="mybutton" @click="sync">Sync</button>
   <button class="mybutton" @click="disconnect">Disconnect</button> -->

   <!-- <h2>Cache contents</h2>
   <SimpleGraph @select="onSelect" />

   <v-checkbox label="Checkbox"></v-checkbox>

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
      <v-data-table :items="databaseStables" show-select item-value="uid" v-model="selectedStable" density="compact" hide-default-footer></v-data-table>
      <v-data-table :items="databaseHorses" density="compact" hide-default-footer></v-data-table>
   </div>

   <div>
      <div><v-btn size="small" @click="getLocalData">Local data</v-btn></div>
      <v-data-table :items="localStables" density="compact" hide-default-footer></v-data-table>
      <v-data-table :items="localHorses" density="compact" hide-default-footer></v-data-table>
   </div>
  
   <div>
      <div><v-btn size="small" @click="getWhere">Where</v-btn></div>
      <v-data-table :items="whereStables" density="compact" hide-default-footer></v-data-table>
      <v-data-table :items="whereHorses" density="compact" hide-default-footer></v-data-table>
   </div> -->

</template>

<script setup>
import { ref, computed, watchEffect } from "vue"
import { format } from 'date-fns'
import * as d3 from "d3"
import { useDebounceFn } from '@vueuse/core'

import { addStableSynchro, addStable, patchStable, deleteStable } from "/src/use/useStable"
import { addHorseSynchro, addHorse, patchHorse, deleteHorse } from "/src/use/useHorse"
import { getUserListObservable, addUserSynchro, addUser, patchUser, deleteUser } from "/src/use/useUser"
import { getGroupListObservable, addGroupSynchro, addGroup, patchGroup, deleteGroup } from "/src/use/useGroup"
import { onlineDate } from '/src/client-app.js'

import { db as stableDB } from '/src/use/useStable.js'
import { db as horseDB } from '/src/use/useHorse.js'
import { synchronizeAll } from '/src/lib/synchronize.js'

import { app, offlineDate, socket } from '/src/client-app.js'

import ReloadPrompt from '/src/components/ReloadPrompt.vue'
import GithubLink from '/src/components/GithubLink.vue'
import OnlineStatus from '/src/components/OnlineStatus.vue'
import SimpleGraph from "/src/components/SimpleGraph.vue"
import RelationGraph from "/src/components/RelationGraph.vue"

const isOnline = computed(() => !!onlineDate.value)
const selectedNode = ref()
const whereStables = ref()
const whereHorses = ref()
const databaseStables = ref()
const databaseHorses = ref()
const localStables = ref()
const localHorses = ref()

const selectedStable = ref()


const searchUser = ref()
const onSearchUser = async () => {
}


const selectedUserNode = ref()
const userTF = ref(null)
const userName = ref('')

const onAddEditUser = async () => {
   if (!selectedUserNode.value) {
      if (userName.value.length > 0) {
         await addUser({ name: userName.value })
      } else {
         alert("Entrez le nom d'abord")
      }
   }
}
const debouncedChangeUserName = useDebounceFn(async (x) => {
   await patchUser(selectedUserNode.value.id, { name: userName.value })
}, 500)

const onDeleteUser = async () => {
   await deleteUser(selectedUserNode.value.id)
   selectedUserNode.value = null
}
const selectedGroupNode = ref()
const groupTF = ref(null)
const groupName = ref('')

const onAddEditGroup = async () => {
   if (!selectedGroupNode.value) {
      if (groupName.value.length > 0) {
         await addGroup({ name: groupName.value })
      } else {
         alert("Entrez le nom d'abord")
      }
   }
}

const onDeleteGroup = async () => {
   await deleteGroup(selectedGroupNode.value.id)
   selectedGroupNode.value = null
}


// Reference to the SVG container
const svgContainer = ref(null);


const userList = ref([])
getUserListObservable().subscribe(users => {
   console.log('users', users)
   userList.value = users
})

const groupList = ref([])
getGroupListObservable().subscribe(groups => {
   console.log('groups', groups)
   groupList.value = groups
})

const nodes = computed(() => {
   if (!userList.value || !groupList.value) return []
   const userNodes = userList.value.map(user => ({ id: user.uid, name: user.name, type: 'user' })).sort((n1, n2) => n1.name<n2.name ? -1 : n1.name>n2.name ? 1 : 0)
   const groupNodes = groupList.value.map(group => ({ id: group.uid, name: group.name, type: 'group' }))
   return [...userNodes, ...groupNodes]
})

const links = computed(() => [])

function drawGraph() {
   if (!nodes.value || !links.value) return
   console.log('nodes', nodes.value)
   // Set up the SVG canvas
   const width = 400
   const height = 400

   // Clear any existing SVG in the container
   d3.select(svgContainer.value).selectAll("svg").remove();

   const svg = d3.select(svgContainer.value)
      .append('svg')
      .attr('width', width)
      .attr('height', height)

   // Define column positions
   const userColumnX = 100 // X position for users
   const groupColumnX = 300 // X position for groups
   const nodeSpacing = 50 // Vertical spacing between nodes

   // Assign fixed positions to nodes
   nodes.value.forEach((node, index) => {
      if (node.type === 'user') {
         node.x = userColumnX
         node.y = (index + 1) * nodeSpacing
      } else {
         node.x = groupColumnX
         node.y = (index - nodes.value.filter(n => n.type === 'user').length + 1) * nodeSpacing
      }
   })

   // Draw links (edges)
   const link = svg.append('g')
      .selectAll('line')
      .data(links.value)
      .enter()
      .append('line')
         .attr("class", "node")
         .attr('stroke', '#999')
         .attr('stroke-width', 2)
         .attr('x1', d => nodes.value.find(n => n.id === d.source).x)
         .attr('y1', d => nodes.value.find(n => n.id === d.source).y)
         .attr('x2', d => nodes.value.find(n => n.id === d.target).x)
         .attr('y2', d => nodes.value.find(n => n.id === d.target).y)

   // Draw nodes
   const node = svg.append('g')
      .selectAll('circle')
      .data(nodes.value)
      .enter()
      .append('circle')
         .attr("class", d => `node ${d.type}`)
         .attr('r', 10)
         .attr('cx', d => d.x)
         .attr('cy', d => d.y)
         .attr('fill', d => (d.type === 'user' ? '#4CAF50' : '#1976D2'))

   // Add labels to nodes
   const label = svg.append('g')
      .selectAll('text')
      .data(nodes.value)
      .enter()
      .append('text')
         .text(d => d.name)
         .attr('font-size', 12)
         .attr('x', d => d.x - 5) // Position labels to the right of nodes
         .attr('y', d => d.y - 15)

   svg.selectAll(".node.user")
      .on("click", async function(event, node) {
         event.stopPropagation()
         d3.selectAll("circle.user").attr("stroke", "none")
         if (selectedUserNode.value?.id === node.id) {
            selectedUserNode.value = null
         } else {
            selectedUserNode.value = node
            userName.value = node.name
            userTF.value.focus()
            d3.select(this).attr("stroke", "red").attr("stroke-width", 3)
         }
      })

   svg.selectAll(".node.group")
      .on("click", async function(event, node) {
         event.stopPropagation()
         d3.selectAll("circle.group").attr("stroke", "none")
         if (selectedGroupNode.value?.id === node.id) {
            selectedGroupNode.value = null
         } else {
            selectedGroupNode.value = node
            groupName.value = node.name
            groupTF.value.focus()
            d3.select(this).attr("stroke", "red").attr("stroke-width", 3)
         }
      })
   svg.on("click", async function() {
      d3.selectAll("circle").attr("stroke", "none")
      selectedUserNode.value = null
      selectedGroupNode.value = null
      userName.value = ''
      groupName.value = ''
   })
}

watchEffect(() => {
   drawGraph()
})













async function getWhere() {
   whereStables.value = await stableDB.whereList.toArray()
   whereHorses.value = await horseDB.whereList.toArray()
}

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

<style scoped>
.graph-container {
  width: 400px;
  height: 400px;
  border: 1px solid #ccc;
}

.node {
  cursor: pointer;
}

.link {
  stroke-opacity: 0.6;
}

.label {
  pointer-events: none;
}
</style>

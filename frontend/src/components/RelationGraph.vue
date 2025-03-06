<script setup>
import * as d3 from "d3"
import { ref, computed, watch, watchEffect } from "vue"

import { getUserListObservable, deleteUser } from '/src/use/useUser'
import { getGroupListObservable } from '/src/use/useGroup'


const emit = defineEmits(['select'])

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
   const userNodes = userList.value.map(user => ({ id: user.uid, name: user.name, type: 'user' }))
   const groupNodes = groupList.value.map(group => ({ id: group.uid, name: group.name, type: 'group' }))
   return [...userNodes, ...groupNodes]
})

const links = computed(() => [])

const selectedUserNode = ref()
const selectedGroupNode = ref()

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
         d3.selectAll("circle.user").attr("stroke", "none")
         if (selectedUserNode.value?.id === node.id) {
            selectedUserNode.value = null
         } else {
            selectedUserNode.value = node
            // emit select event
            emit('select', node)
            // circle in red
            d3.select(this).attr("stroke", "red").attr("stroke-width", 3)
         }
      })

   svg.selectAll(".node.group")
      .on("click", async function(event, node) {
         d3.selectAll("circle.group").attr("stroke", "none")
         if (selectedGroupNode.value?.id === node.id) {
            selectedGroupNode.value = null
         } else {
            selectedGroupNode.value = node
            // emit select event
            emit('select', node)
            // circle in red
            d3.select(this).attr("stroke", "red").attr("stroke-width", 3)
         }
      })

}

watchEffect(() => {
   drawGraph()
})
</script>

<template>
  <div ref="svgContainer" class="graph-container"></div>
</template>

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

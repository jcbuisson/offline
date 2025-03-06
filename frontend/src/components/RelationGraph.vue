<script setup>
import * as d3 from "d3"
import { onMounted, ref, computed, watch, watchEffect } from "vue"

import { getUserListObservable } from '/src/use/useUser'
import { getGroupListObservable } from '/src/use/useGroup'


const emit = defineEmits(['select'])

// Reference to the SVG container
const svgContainer = ref(null);

onMounted(() => {
   // drawGraph()
})

const data = {
   nodes: [
      { id: 'user1', type: 'user' },
      { id: 'user2', type: 'user' },
      { id: 'user3', type: 'user' },
      { id: 'group1', type: 'group' },
      { id: 'group2', type: 'group' },
   ],
   links: [
      { source: 'user1', target: 'group1' },
      { source: 'user2', target: 'group1' },
      { source: 'user2', target: 'group2' },
      { source: 'user3', target: 'group2' },
   ],
}

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
   const userNodes = userList.value.map(user => ({ id: user.name, type: 'user' }))
   const groupNodes = groupList.value.map(group => ({ id: group.name, type: 'group' }))
   return [...userNodes, ...groupNodes]
})

const links = computed(() => [])

const selectedNode = ref()

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
         .attr("class", "node")
         .attr('r', 10)
         .attr('cx', d => d.x)
         .attr('cy', d => d.y)
         .attr('fill', d => (d.type === 'user' ? '#4CAF50' : '#1976D2')) // Color nodes by type

   // Add labels to nodes
   const label = svg.append('g')
      .selectAll('text')
      .data(nodes.value)
      .enter()
      .append('text')
         .text(d => d.id)
         .attr('font-size', 12)
         .attr('x', d => d.x + 15) // Position labels to the right of nodes
         .attr('y', d => d.y + 4)

   // node select
   svg.selectAll(".node")
      .on("click", function(event, node) {
         d3.selectAll("circle").attr("stroke", "none")
         if (selectedNode.value?.id === node.id) {
            selectedNode.value = null
         } else {
            selectedNode.value = node
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

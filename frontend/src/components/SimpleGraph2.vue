<script setup>
import * as d3 from "d3"
import { onMounted, ref, computed, watch, watchEffect } from "vue"

import { stableList } from "/src/use/useStable"
import { horseList } from "/src/use/useHorse"

const emit = defineEmits(['select'])


const nodesX = computed(() => {
   const nodeList = []
   const stableNodes = stableList.value || []
   stableNodes.forEach((node, index) => {
      nodeList.push({
         id: node.uid,
         type: 'stable',
         color: 'cyan',
         uid: node.uid,
         name: node.name,
         // x: 150 + index*300,
         // y: 100,
      })
   })
   const horseNodes = horseList.value || []
   horseNodes.forEach((node, index) => {
      nodeList.push({
         id: node.uid,
         type: 'horse',
         color: 'orange',
         uid: node.uid,
         name: node.name,
         // x: 150 + index*300,
         // y: 200,
      })
   })
   return nodeList
})

const linksX = computed(() => {
   if (!stableList.value || !stableList.value.length) return []
   if (!horseList.value || !horseList.value.length) return []
   return horseList.value.reduce((accu, horse) => {
      if (horse.stable_uid) {
         accu.push({
            source: horse.uid,
            target: horse.stable_uid
         })
      }
      return accu
   }, [])
})


// Reference to the SVG container
const svgContainer = ref(null);

onMounted(() => {
   drawGraph()
})

function drawGraph() {
   const width = 600
   const height = 300

   // Clear any existing SVG in the container
   d3.select(svgContainer.value).selectAll("svg").remove();

   // Create the SVG container
   const svg = d3
      .select(svgContainer.value)
      .append("svg")
      .attr("width", width)
      .attr("height", height)

   // Add a force simulation
   const simulation = d3
      .forceSimulation(nodesX.value)
      .force(
         "link",
         d3
         .forceLink(linksX.value)
         .id((d) => d.id)
         .distance(100)
      )
      .force("charge", d3.forceManyBody().strength(-50))
      .force("center", d3.forceCenter(width / 2, height / 2))

   // Draw links (lines)
   const link = svg
      .selectAll(".link")
      .data(linksX.value)
      .enter()
      .append("line")
      .attr("class", "link")
      .attr("stroke", "#999")
      .attr("stroke-width", 2)

   // Draw nodes (circles)
   const node = svg
      .selectAll(".node")
      .data(nodesX.value)
      .enter()
      .append("circle")
      .attr("class", "node")
      .attr("r", 10)
      .attr("fill", "steelblue")
      .call(
         d3
         .drag()
         .on("start", (event, d) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
         })
         .on("drag", (event, d) => {
            d.fx = event.x;
            d.fy = event.y;
         })
         .on("end", (event, d) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
         })
      )

   // Add labels for nodes
   const label = svg
      .selectAll(".label")
      .data(nodesX.value)
      .enter()
      .append("text")
      .attr("class", "label")
      .attr("text-anchor", "middle")
      .attr("dy", -15)
      .text((d) => d.name)
      .attr("font-size", 12)
      .attr("fill", "#333")


   svg.selectAll(".node")
      .on("click", function(event, stable) {
         // emit select event
         emit('select', stable)
         d3.selectAll("circle")
            .attr("stroke", "none")
         d3.select(this)
            .attr("stroke", "red")
            .attr("stroke-width", 3)
      })


   // Update positions on every tick
   simulation.on("tick", () => {
      link
         .attr("x1", (d) => d.source.x)
         .attr("y1", (d) => d.source.y)
         .attr("x2", (d) => d.target.x)
         .attr("y2", (d) => d.target.y)

      node.attr("cx", (d) => d.x).attr("cy", (d) => d.y)

      label.attr("x", (d) => d.x).attr("y", (d) => d.y)
   })
}

// watch(() => nodesX, () => {
//    drawGraph()
// }, { deep: true })
// watch(() => linksX, () => {
//    drawGraph()
// }, { deep: true })
watchEffect(() => {
   drawGraph()
})
</script>

<template>
  <div ref="svgContainer" class="graph-container"></div>
</template>

<style scoped>
.graph-container {
  width: 600px;
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

<script setup>
import { ref, onMounted, watch, computed } from "vue"
import * as d3 from "d3"

import { stableList } from "/src/use/useStable"
import { horseList } from "/src/use/useHorse"

const emit = defineEmits(['select'])

const container = ref(null)

onMounted(() => {
   drawGraph()
})

const nodes = computed(() => {
   const nodeList = []
   const stableNodes = stableList.value || []
   stableNodes.forEach((node, index) => {
      nodeList.push({
         id: node.uid,
         type: 'stable',
         color: 'cyan',
         uid: node.uid,
         name: node.name,
         x: 150 + index*300,
         y: 100,
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
         x: 150 + index*300,
         y: 200,
      })
   })
   return nodeList
})

const links = computed(() => {
   if (!stableList.value || !stableList.value.length) return []
   if (!horseList.value || !horseList.value.length) return []
   return [{ source: stableList.value[0], target: horseList.value[0] }]
})

const drawGraph = () => {
   d3.select(container.value).select("svg").remove() // Clear previous graph

   const svg = d3.select(container.value)
      .append("svg")
      .attr("width", "100%")
      .attr("height", 400)

         
   // svg.selectAll(".link")
   //    .data(links.value)
   //    .enter()
   //    .append("line")
   //    .attr("class", "link")
   //    .attr("stroke", "#999")
   //    .attr("stroke-width", 2);

   //    // .append("text")
   //    // .attr("x", d => 180)
   //    // .attr("y", d => 320)
   //    // .attr("text-anchor", "middle")
   //    // .text(d => "line")
   //    // .attr("fill", "black")
   //    // .attr("font-size", "14px")


   svg.selectAll("circle")
      .data(nodes.value)
      .enter()
      .append("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 20)
      .attr("fill", d => d.color)

   svg.selectAll("text")
      .data(nodes.value)
      .enter()
      .append("text")
      .attr("x", d => d.x)
      .attr("y", d => d.y - 25)
      .attr("text-anchor", "middle")
      .text(d => d.name)
      .attr("fill", "black")
      .attr("font-size", "14px")

   svg.selectAll("circle")
      .on("click", function(event, stable) {
         // emit select event
         emit('select', stable)
         d3.selectAll("circle")
            .attr("stroke", "none")
         d3.select(this)
            .attr("stroke", "steelblue")
            .attr("stroke-width", 3)
      })

}

// Watch for changes in graphData and update the graph
watch(() => nodes, () => {
   drawGraph()
}, { deep: true })
watch(() => links, () => {
   console.log('links.value', links.value)
   drawGraph()
}, { deep: true })
</script>

<template>
   <div ref="container" class="d3-container"></div>
</template>

<style>
.d3-container {
   width: 100%;
   height: 400px;
   border: 1px solid #ccc;
   margin-top: 10px;
}
button {
   margin-bottom: 10px;
   padding: 8px;
   cursor: pointer;
}
.link {
  stroke-opacity: 0.6;
}
</style>

<script setup>
import { ref, onMounted, watch } from "vue"
import * as d3 from "d3"

import { stableList } from "/src/use/useStable"

const container = ref(null)

// const graphData = ref([
//    { id: "A", x: 100, y: 100 },
//    { id: "B", x: 200, y: 200 },
// ])

onMounted(() => {
   drawGraph()
})

const graphData = computed(() => {
   if (!stableList.value) return []
   const list = stableList.value
   const nodes = list.map((stable, index) => ({
      uid: stable.uid,
      name: stable.name,
      x: 150 + index*300,
      y: 100,
   }))
   const links = []
   return { nodes, links }
})

const drawGraph = () => {
   d3.select(container.value).select("svg").remove() // Clear previous graph

   const svg = d3.select(container.value)
      .append("svg")
      .attr("width", "100%")
      .attr("height", 400)

   svg.selectAll("circle")
      .data(graphData.value.nodes)
      .enter()
      .append("circle")
      .attr("cx", d => d.x)
      .attr("cy", d => d.y)
      .attr("r", 20)
      .attr("fill", "cyan")

   svg.selectAll("text")
      .data(graphData.value.nodes)
      .enter()
      .append("text")
      .attr("x", d => d.x)
      .attr("y", d => d.y - 25)
      .attr("text-anchor", "middle")
      .text(d => d.name)
      .attr("fill", "black")
      .attr("font-size", "14px")

   svg.selectAll("circle")
      .on("click", function(event, d) {
         console.log('this', this)
         d3.selectAll("circle")
            .attr("stroke", "none")
         d3.select(this)
            .attr("stroke", "steelblue")
            .attr("stroke-width", 3)
      })
}

// Watch for changes in graphData and update the graph
watch(graphData, () => {
   drawGraph();
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
</style>

<script setup>
import { onMounted, ref } from "vue";
import Graph from "graphology";
import Sigma from "sigma";

const container = ref(null);

onMounted(() => {
  // 1️⃣ Create a new graph instance
  const graph = new Graph();

  // 2️⃣ Define tree nodes
  graph.addNode("Root", { x: 0, y: 0, size: 15, label: "Root", color: "red" });
  graph.addNode("A", { x: -1, y: -1, size: 10, label: "A", color: "blue" });
  graph.addNode("B", { x: 1, y: -1, size: 10, label: "B", color: "blue" });
  graph.addNode("C", { x: -1.5, y: -2, size: 8, label: "C", color: "green" });
  graph.addNode("D", { x: -0.5, y: -2, size: 8, label: "D", color: "green" });
  graph.addNode("E", { x: 0.5, y: -2, size: 8, label: "E", color: "green" });
  graph.addNode("F", { x: 1.5, y: -2, size: 8, label: "F", color: "green" });

  // 3️⃣ Define edges (tree structure)
  graph.addEdge("Root", "A");
  graph.addEdge("Root", "B");
  graph.addEdge("A", "C");
  graph.addEdge("A", "D");
  graph.addEdge("B", "E");
  graph.addEdge("B", "F");

  // 4️⃣ Initialize Sigma.js with the graph
  new Sigma(graph, container.value);
});
</script>

<template>
  <div ref="container" class="sigma-container"></div>
</template>

<style>
.sigma-container {
  width: 600px;
  height: 400px;
  border: 1px solid #ccc;
}
</style>

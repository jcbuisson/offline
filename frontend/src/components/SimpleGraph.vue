<script setup>
import * as d3 from "d3";
import { onMounted, ref } from "vue";

// Sample data
const nodes = [
  { id: "Node 1" },
  { id: "Node 2" },
  { id: "Node 3" },
  { id: "Node 4" },
];

const links = [
  { source: "Node 1", target: "Node 2" },
  { source: "Node 2", target: "Node 3" },
  { source: "Node 3", target: "Node 4" },
  { source: "Node 4", target: "Node 1" },
];

// Reference to the SVG container
const svgContainer = ref(null);

onMounted(() => {
  const width = 600;
  const height = 400;

  // Create the SVG container
  const svg = d3
    .select(svgContainer.value)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  // Add a force simulation
  const simulation = d3
    .forceSimulation(nodes)
    .force(
      "link",
      d3
        .forceLink(links)
        .id((d) => d.id)
        .distance(100)
    )
    .force("charge", d3.forceManyBody().strength(-300))
    .force("center", d3.forceCenter(width / 2, height / 2));

  // Draw links (lines)
  const link = svg
    .selectAll(".link")
    .data(links)
    .enter()
    .append("line")
    .attr("class", "link")
    .attr("stroke", "#999")
    .attr("stroke-width", 2);

  // Draw nodes (circles)
  const node = svg
    .selectAll(".node")
    .data(nodes)
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
    );

  // Add labels for nodes
  const label = svg
    .selectAll(".label")
    .data(nodes)
    .enter()
    .append("text")
    .attr("class", "label")
    .attr("text-anchor", "middle")
    .attr("dy", -15)
    .text((d) => d.id)
    .attr("font-size", 12)
    .attr("fill", "#333");

  // Update positions on every tick
  simulation.on("tick", () => {
    link
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y);

    node.attr("cx", (d) => d.x).attr("cy", (d) => d.y);

    label.attr("x", (d) => d.x).attr("y", (d) => d.y);
  });
});
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

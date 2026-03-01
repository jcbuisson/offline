<template>
   <div class="split-wrapper">
      <div class="split-container">
         <!-- Left Panel with Slot -->
         <div class="left-panel" :style="{ width: leftWidth + 'px' }">
            <slot name="left-panel"></slot>
         </div>

         <!-- Draggable Splitter -->
         <div ref="splitter" class="splitter" @mousedown="startResize" @touchstart="startResize"></div>

         <!-- Right Panel with Slot -->
         <div class="right-panel" :style="{ width: `calc(100% - ${leftWidth}px)` }">
            <slot name="right-panel"></slot>
         </div>
      </div>
   </div>
</template>
 
<script setup>
import { ref } from 'vue'

const leftWidth = ref(300) // Initial width of the left panel
const isResizing = ref(false)

const splitter = ref(null)

function startResize(e) {
   console.log('startResize')
   isResizing.value = true
   window.addEventListener('mousemove', resize)
   window.addEventListener('mouseup', stopResize)
   window.addEventListener('touchmove', resize)
   window.addEventListener('touchend', stopResize)
}

function resize(e) {
   const x = e.clientX || e.changedTouches[0].clientX
   if (isResizing.value) {
      leftWidth.value = x
   }
}

function stopResize() {
   isResizing.value = false
   window.removeEventListener('mousemove', resize)
   window.removeEventListener('mouseup', stopResize)
   window.removeEventListener('touchmove', resize)
   window.removeEventListener('touchend', stopResize)
}
</script>
 
<style scoped>
.split-wrapper {
   height: 100%;
   width: 100%;
}

.split-container {
   display: flex;
   width: 100%;
   height: 100%;
   position: relative;
}

.left-panel,
.right-panel {
   height: 100%;
   overflow: auto;
}

.splitter {
   width: 5px;
   background-color: #ddd;
   cursor: col-resize;
   height: 100%;
}

.left-panel {
   background-color: #f5f5f5;
}

.right-panel {
   background-color: #e0e0e0;
}
</style>
<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import useExpressXClient from '/src/useExpressXClient'

const { state } = useExpressXClient()
const needRefresh = ref(false)
const updating = ref(false)
const editing = ref(false)
let interval: ReturnType<typeof setInterval> | undefined
let updateTimer: ReturnType<typeof setTimeout> | undefined
let registration: ServiceWorkerRegistration | undefined
let installing: ServiceWorker | undefined
let controller = navigator.serviceWorker?.controller
let needsReload = false
let reloading = false
let disposed = false

function scheduleUpdate() {
   clearTimeout(updateTimer)
   if (disposed || !needRefresh.value || editing.value || state.activity.writes || (updating.value && !needsReload)) return
   // Allow debounced autosaves to enter their durable local write queue first.
   updateTimer = setTimeout(() => {
      if (disposed || editing.value || state.activity.writes) return
      if (needsReload) {
         if (!reloading) { reloading = true; window.location.reload() }
         return
      }
      if (!registration?.waiting) return
      updating.value = true
      try { registration.waiting.postMessage({ type: 'SKIP_WAITING' }) }
      catch (error) {
         updating.value = false
         console.warn('Automatic update deferred', error)
      }
   }, 1000)
}

async function checkForUpdate() {
   if (disposed || !navigator.onLine) return
   try { await registration?.update() }
   catch (error) { console.warn('Unable to check for an update', error) }
   if (registration?.waiting) needRefresh.value = true
   scheduleUpdate()
}

function onInstalled() {
   if (installing?.state === 'installed' && navigator.serviceWorker.controller) needRefresh.value = true
}
function onUpdateFound() {
   installing?.removeEventListener('statechange', onInstalled)
   installing = registration?.installing ?? undefined
   installing?.addEventListener('statechange', onInstalled)
   onInstalled()
}
function onControllerChange() {
   const next = navigator.serviceWorker.controller
   const replacing = Boolean(controller && next && controller !== next)
   controller = next
   if (!replacing) return // First installation can claim the page without a reload.
   needsReload = true
   needRefresh.value = true
   scheduleUpdate()
}
function updateEditing() {
   queueMicrotask(() => {
      editing.value = Boolean(document.activeElement?.matches('input, textarea, select, [contenteditable="true"], [role="combobox"]'))
   })
}
function checkWhenVisible() {
   if (document.visibilityState === 'visible') void checkForUpdate()
}

watch([needRefresh, editing, () => state.activity.writes], scheduleUpdate)
onMounted(() => {
   if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return
   navigator.serviceWorker.addEventListener('controllerchange', onControllerChange)
   void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`, {
      scope: import.meta.env.BASE_URL, updateViaCache: 'none',
   }).then(value => {
      if (disposed) return
      registration = value
      registration.addEventListener('updatefound', onUpdateFound)
      onUpdateFound()
      if (registration.waiting) needRefresh.value = true
      interval = setInterval(checkForUpdate, 10000)
   }).catch(error => console.warn('Service worker registration failed', error))
   document.addEventListener('focusin', updateEditing)
   document.addEventListener('focusout', updateEditing)
   document.addEventListener('visibilitychange', checkWhenVisible)
   window.addEventListener('online', checkForUpdate)
   updateEditing()
})

onUnmounted(() => {
   disposed = true
   clearInterval(interval)
   clearTimeout(updateTimer)
   registration?.removeEventListener('updatefound', onUpdateFound)
   installing?.removeEventListener('statechange', onInstalled)
   navigator.serviceWorker?.removeEventListener('controllerchange', onControllerChange)
   document.removeEventListener('focusin', updateEditing)
   document.removeEventListener('focusout', updateEditing)
   document.removeEventListener('visibilitychange', checkWhenVisible)
   window.removeEventListener('online', checkForUpdate)
})
</script>

<template>
   <div v-if="needRefresh" class="update-notice" role="status" aria-live="polite">
      <v-progress-circular v-if="updating" indeterminate :size="20" :width="2" color="primary" aria-hidden="true" />
      {{ updating ? 'Mise à jour en cours…' : editing || state.activity.writes ? 'Nouvelle version prête. Mise à jour après la saisie…' : 'Une nouvelle version va être installée…' }}
   </div>
</template>

<style scoped>
.update-notice {
   position: fixed;
   bottom: 24px;
   right: 24px;
   max-width: calc(100vw - 48px);
   display: flex;
   align-items: center;
   gap: 12px;
   padding: 16px;
   color: #24523a;
   background: #dcfce7;
   border-radius: 8px;
   box-shadow: 0 2px 8px #0002;
   z-index: 2500;
}
</style>

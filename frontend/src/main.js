import { createApp } from 'vue'
import '@mdi/font/css/materialdesignicons.css'
import App from './App.vue'
import router from './router'
import { initializeSync } from './sync'

import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import * as components from 'vuetify/components'
import * as directives from 'vuetify/directives'

import './style.css'; // SEMBLE PAS PRIS EN COMPTE

const vuetify = createVuetify({
   components,
   directives,
})
 
initializeSync().then(() => createApp(App)
   .use(vuetify)
   .use(router)
   .mount('#app')).catch(error => {
      console.error('Could not initialize offline storage', error)
      document.querySelector('#app').textContent = 'Could not open offline storage. Please reload the page.'
   })
   
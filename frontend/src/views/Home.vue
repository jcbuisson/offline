<template>
   <v-app class="h-screen overflow-hidden">

      <!-- makes the layout a vertical stack filling the full screen -->
      <div class="d-flex flex-column fill-height">
         <!-- Toolbar (does not grow) -->
         <v-toolbar>
            <v-toolbar-title text="Application offline-first, temps-réel, avec backend relationnel"></v-toolbar-title>
            <!-- <v-toolbar-title text="Why fetch when you can sync?"></v-toolbar-title> -->

            <template v-slot:append>
               <div class="d-flex ga-2">
                  <v-btn size="small" @click="explanationDialog = true">Explications</v-btn>
                  <v-btn size="small" @click="clearCaches">Clear</v-btn>
                  <OnlineButton :isOnline="isConnected" @connect="connect" @disconnect="disconnect"></OnlineButton>
                  <GithubLink url="https://github.com/jcbuisson/offline" svgPath="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5c.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34c-.46-1.16-1.11-1.47-1.11-1.47c-.91-.62.07-.6.07-.6c1 .07 1.53 1.03 1.53 1.03c.87 1.52 2.34 1.07 2.91.83c.09-.65.35-1.09.63-1.34c-2.22-.25-4.55-1.11-4.55-4.92c0-1.11.38-2 1.03-2.71c-.1-.25-.45-1.29.1-2.64c0 0 .84-.27 2.75 1.02c.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02c.55 1.35.2 2.39.1 2.64c.65.71 1.03 1.6 1.03 2.71c0 3.82-2.34 4.66-4.57 4.91c.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2"></GithubLink>
               </div>
            </template>
         </v-toolbar>
         
         <!-- Tabsbar (does not grow) -->
         <v-tabs v-model="currentTab">
            <v-tab text="Utilisateurs" value="users" @click="router.push('/users')"></v-tab>
            <v-tab text="Groupes" value="groups" @click="router.push('/groups')"></v-tab>
         </v-tabs>

         <!-- Fills remaining vertical space -->
         <div class="d-flex flex-column flex-grow-1 overflow-auto">
            <router-view />
         </div>

      </div>
   </v-app>

   <v-dialog v-model="explanationDialog" width="auto">
      <v-card max-width="1024">

         <v-card-title class="d-flex justify-space-between align-center">
            <div class="text-h5 text-medium-emphasis ps-2">
               Explications
            </div>

            <v-btn
               icon="mdi-close"
               variant="text"
               @click="explanationDialog = false"
            ></v-btn>
         </v-card-title>

         <v-divider class="mb-4"></v-divider>

         <v-card-text>
            <ul>
               <li>Le développeur peut créer pour son application un schéma de base de données relationnelle quelconque,
                  avec des relations one-to-many et many-to-many, des on-delete-cascade etc.
               </li>
               <li>Dans cet exemple, voici le schéma de la base de données :</li>

               <pre>
model metadata {
   uid                     String     @unique  // `uid` is unique across models
   created_at              DateTime?
   updated_at              DateTime?
   deleted_at              DateTime?
}

//////////////        BUSINESS MODELS        //////////////

model user {
   uid                     String     @unique
   firstname               String?
   lastname                String?
   email                   String?    @unique

   user_group_relations    user_group_relation[]
}

model group {
   uid                     String     @unique
   name                    String?    @unique(map: "group_name_unique")

   user_group_relations    user_group_relation[]
}

// relations (here: many-to-many between `user` and `group`) need to be explicitely defined
model user_group_relation {
   uid             String     @unique
   user_uid        String
   group_uid       String

   user user @relation(fields: [user_uid], references: [uid], onDelete: Cascade, onUpdate: NoAction)
   group group @relation(fields: [group_uid], references: [uid], onDelete: Cascade, onUpdate: NoAction)
   @@unique([user_uid, group_uid])
}
               </pre>

               <li>Il y a seulement une contrainte : les clés primaires de ces tables sont des uid et non des identifiants auto-incrémentés</li>
               <li>Le système de synchronisation gère par ailleurs une table `metadata` qui associe à chaque uid des attributs `created_at`, `updated_at`, `deleted_at`</li>

               <li>Les clients ont des caches dénormalisés pour chaque table/modèle. Ces caches implémentés avec IndexeDB ne sont pas limités en taille.</li>
               <li>Ces caches permettent toutes les opérations relationnelles : accès aux objets, aux listes, jointures entre modèles, etc.</li>
               <li>Les clés primaires de ces caches sont les uid, créés explicitement par les clients, pour ne pas avoir de conflit entre les identifiants créés offline par différents clients</li>
               <li>Le client possède également un cache Indexedb appelé `metadata` qui associe à chaque uid des attributs ‘createdAt’, ‘updatedAt’ et ‘deletedAt’</li>

               <li>Toutes les opérations sont effectuées, d’abord sur ces caches (optimistic updates), puis envoyées à la base de données</li>
               <li>Les clients doivent expliciter le périmètre de leur synchronisation. Ils ne veulent pas être synchronisés avec toute la BD, seulement avec la partie qui les concerne. Ils le font en précisant les clauses ‘where’ des requêtes de base de données pour les données qui les concernent.</li>
               <li>Les opérations de base de données donnent lieu à l’envoi d’événements vers les clients, qui peuvent mettre à jour leurs caches en temps-réel. Grace à ces mises à jour en continu, un client qui part d’un état synchronisé avec le serveur, reste synchrone tant qu’il n’y a pas de déconnexion, quelles que soient les opérations que lui ou les autres clients réalisent</li>
               <li>Le client peut donc toujours considérer que la source de vérité est le contenu de ses caches, après un temps de resynchronisation</li>

               <li>À chaque reconnexion (y compris au démarrage), pour chaque table, et pour chaque requête `where` de son périmètre de synchronisation, le client demande une synchronisation au serveur</li>
               <ul>Le service de synchronisation reçoit :
                  <li>La requête ‘where’</li>
                  <li>Les meta-data du sous-ensemble du cache du client associé à la requête</li>
                  <li>La date de ‘cutoff’ (dernière déconnexion)</li>
               </ul>
               <ul>Le service de synchronisation :
                  <li>Calcule les couples clé/valeur de la base de données associés à la requête ‘where’</li>
                  <li>Compare avec ceux reçus du client, relativement à la date de cutoff</li>
                  <li>Il réalise dans la base de données les changements nécessaires.</li>
                  <li>Il renvoie au client les changements nécessaires de son cache</li>
               </ul>
               <li>À l’issue de la synchronisation, le serveur et le client sont dans le même état du point de vue des valeurs relatives à la requête ‘where’</li>
               <li>Le service de synchronisation côté serveur est en exclusion mutuelle pour que les demandes synchronisation provenant des clients ne se chevauchent pas</li>
            </ul>
         </v-card-text>
      </v-card>
   </v-dialog>
</template>

<script setup>
import { ref, watch, computed } from 'vue'
import { useRoute} from 'vue-router'

import GithubLink from '/src/components/GithubLink.vue'
import OnlineButton from '/src/components/OnlineButton.vue'

import { app, connect, disconnect } from '/src/client-app.ts'

import router from '/src/router'

import { userModel, groupModel, userGroupRelationModel } from '/src/client-app.ts';

const isConnected = computed(() => !!app.isConnected);


// synchronize when connection starts or restarts
// it is located here because of import circularity issues
app.addConnectListener(async () => {
   console.log(">>>>>>>>>>>>>>>> SYNC ALL")
   // order matters
   await userModel.synchronizeAll()
   await groupModel.synchronizeAll()
   await userGroupRelationModel.synchronizeAll()
})

async function clearCaches() {
   await userModel.reset()
   await groupModel.reset()
   await userGroupRelationModel.reset()
}

const currentTab = ref('users')

const route = useRoute()
const routeRegex = /\/(users|groups)/

watch(() => [route.path], async () => {
   console.log('route.path', route.path)
   const match = route.path.match(routeRegex)
   if (!match) return
   const tab = match[1]
   currentTab.value = tab
}, { immediate: true })

const explanationDialog = ref(false)
</script>

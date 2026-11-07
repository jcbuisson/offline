<template>
   <div class="pa-4 bg-grey-lighten-4 overflow-auto" style="flex: 1 1 0; min-height: 0">
      <h2 class="text-h6 mb-2">Les données de l’application</h2>
      <p>PostgreSQL conserve les utilisateurs, les groupes et leurs appartenances.
         Les identifiants UUID sont créés dans le navigateur. Les contraintes d’unicité
         et les suppressions en cascade sont appliquées dans les bases relationnelles.</p>
      <h2 class="text-h6 mt-4 mb-2">Travailler hors ligne</h2>
      <p>L’interface utilise une base PGlite persistante et des observables.
         Chaque modification est enregistrée localement avec une transaction en attente.
         PouchDB conserve les documents à répliquer, même après un rechargement.</p>
      <h2 class="text-h6 mt-4 mb-2">Synchroniser avec PGCouch</h2>
      <p>PouchDB réplique les transactions vers CouchDB. Le serveur les valide et les applique
         atomiquement dans PostgreSQL. Il publie une décision et un instantané des trois tables.
         Le navigateur applique cet instantané puis rejoue ses transactions encore en attente.</p>
      <p>Une transaction refusée est annulée localement et signalée dans l’interface.
         Les suppressions retirent les lignes et leurs appartenances en cascade.
         Les modifications concurrentes sont ordonnées par le serveur ; une contrainte
         incompatible entraîne le refus de toute la transaction.</p>
      <h2 class="text-h6 mt-4 mb-2">Plusieurs onglets</h2>
      <p>Un seul onglet utilise la base locale à la fois. Un autre onglet attend que le premier
         soit fermé pour ouvrir la même base et reprendre la synchronisation.</p>
   </div>
</template>

<template>
   <div class="explanations pa-4 bg-grey-lighten-4 overflow-auto">
      <h2 class="text-h6 mb-2">Les données de l’application</h2>
      <p>PostgreSQL conserve les utilisateurs, les groupes et leurs associations.
         Les contraintes d’unicité et les clés étrangères sont vérifiées dans la base.
         Supprimer un utilisateur ou un groupe supprime aussi ses associations.</p>
      <h2 class="text-h6 mt-4 mb-2">Écrire avec SQL</h2>
      <p>Le client appelle des requêtes nommées via express-x. Le serveur conserve le SQL
         et transmet les valeurs séparément à PostgreSQL. Les écritures nécessitent une
         connexion ; aucune file d’écriture hors ligne n’est conservée.</p>
      <h2 class="text-h6 mt-4 mb-2">Recevoir les changements</h2>
      <p>Electric transmet les lignes des trois tables avec des flux « Shapes ».
         Des observables mettent les listes à jour. Les données restent en mémoire pendant
         la session ; elles ne sont pas enregistrées dans une base locale persistante.</p>
      <h2 class="text-h6 mt-4 mb-2">Disponibilité hors ligne</h2>
      <p>Le service worker conserve les fichiers de l’application après une première visite.
         Charger les données et enregistrer des changements demande une connexion au serveur.</p>
   </div>
</template>

<style scoped>
.explanations {
   flex: 1 1 0;
   min-height: 0;
   overflow-wrap: anywhere;
}
</style>

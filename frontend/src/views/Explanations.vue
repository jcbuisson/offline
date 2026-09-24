<template>
   <div class="pa-4 bg-grey-lighten-4 overflow-auto">
      <h2 class="text-h6 mb-2">Les données de l’application</h2>
      <p>PostgreSQL conserve les utilisateurs, les groupes et leurs associations dans trois tables :
         <code>user</code>, <code>group</code> et <code>user_group_relation</code>.
         Un utilisateur peut appartenir à plusieurs groupes, et un groupe peut réunir plusieurs utilisateurs.</p>
      <p>Chaque objet possède un identifiant <code>uid</code> de type UUID, généré par le client.
         Il peut ainsi être créé hors ligne sans attendre un identifiant du serveur.
         Les e-mails, les noms de groupes et les couples utilisateur/groupe sont soumis
         à des contraintes d’unicité côté serveur.</p>

      <h2 class="text-h6 mt-4 mb-2">Travailler hors ligne</h2>
      <p>Le navigateur utilise une base locale PGlite, persistée dans IndexedDB.
         L’interface lit les données locales et réagit à leurs changements grâce à des observables.
         Les données déjà chargées restent accessibles sans connexion, dans les limites
         du stockage accordé par le navigateur.</p>
      <p>Une création, une modification ou une suppression est d’abord enregistrée localement :
         son résultat apparaît immédiatement. Une file persistante conserve les mutations
         à transmettre au serveur, y compris après un rechargement de la page.</p>

      <h2 class="text-h6 mt-4 mb-2">Synchroniser avec le serveur</h2>
      <p>Lorsque la connexion est disponible, le client envoie les mutations en attente via express-x
         aux services du plugin <code>electricServerPlugin</code>.
         Chaque mutation porte un identifiant de client et un numéro de révision.
         Le serveur mémorise la dernière révision traitée pour chaque client et chaque objet,
         afin de ne pas réappliquer une mutation déjà traitée ou plus ancienne.
         Ce mécanisme ne fusionne pas les modifications concurrentes de clients différents.</p>
      <p>Dans l’autre sens, Electric transmet les changements de PostgreSQL au navigateur au moyen
         de flux appelés « Shapes ». Dans cet exemple, les trois modèles sont synchronisés.
         Les filtres de l’interface sélectionnent ensuite les données locales à afficher.</p>
      <p>La réponse à une mutation fournit une version attribuée par le serveur.
         Le client conserve la mutation en attente jusqu’à ce que le flux Electric confirme
         cette version, ou une version plus récente. Une coupure réseau laisse les mutations
         en attente pour une nouvelle tentative ; une erreur de validation ou de contrainte
         peut empêcher leur application.</p>

      <h2 class="text-h6 mt-4 mb-2">Conserver la trace des suppressions</h2>
      <p>Une suppression synchronisée conserve une ligne marquée <code>deleted = true</code>,
         appelée « tombstone ». Invisible dans les listes, elle permet de transmettre et de confirmer
         la suppression, même si celle-ci arrive au serveur avant la création effectuée hors ligne.</p>
      <p>Les champs soumis à l’unicité sont alors libérés : l’e-mail d’un utilisateur,
         le nom d’un groupe ou les références d’une association sont mis à <code>NULL</code>.
         Une nouvelle ligne peut ainsi réutiliser ces valeurs.</p>

      <h2 class="text-h6 mt-4 mb-2">Préparer le schéma au démarrage</h2>
      <p>Avant d’accepter les requêtes, le serveur appelle <code>prepareSyncSchema(db)</code>.
         Cette fonction adapte les tables existantes aux besoins de la synchronisation :</p>
      <ul class="pl-6 my-2">
         <li>Elle rend les références <code>user_uid</code> et <code>group_uid</code> de la table
            d’association facultatives pour permettre l’insertion de tombstones.</li>
         <li>Elle appelle <code>prepareElectricSyncSchema</code> pour ajouter les colonnes
            <code>version</code> et <code>deleted</code> aux trois tables synchronisées.</li>
         <li>Elle crée, si nécessaire, la séquence qui fournit les versions et la table
            <code>electric_mutation_cursor</code>, qui mémorise les révisions déjà traitées.</li>
      </ul>
      <p>Cette préparation peut être relancée à chaque démarrage. Elle s’exécute dans une transaction :
         si une étape échoue, ses changements sont annulés et le serveur ne démarre pas.
         La synchronisation elle-même est ensuite assurée par le plugin.</p>

      <h2 class="text-h6 mt-4 mb-2">Partager les données entre onglets</h2>
      <p>Les onglets partagent la base PGlite locale. Un onglet leader assure la synchronisation réseau
         et les autres sont informés des changements par un <code>BroadcastChannel</code>.
         Si le leader change, le nouveau leader prend le relais.</p>
   </div>
</template>

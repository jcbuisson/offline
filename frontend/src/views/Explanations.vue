<template>
   <div class="pa-4 bg-red">
      <ul>
         <p>Le développeur peut créer pour son application un schéma de base de données relationnelle quelconque,
            avec des relations one-to-many et many-to-many, des on-delete-cascade etc.
         </p>
         <p>Dans cet exemple, voici le schéma de la base de données :</p>
      </ul>

      <pre>
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

      <p>Il y a seulement une contrainte : les clés primaires de ces tables sont des uid et non des identifiants auto-incrémentés</p>
      <p>Le système de synchronisation gère par ailleurs une table `metadata` qui associe à chaque uid des attributs `created_at`, `updated_at`, `deleted_at`</p>

      <p>Les clients ont des caches dénormalisés pour chaque table/modèle. Ces caches implémentés avec IndexeDB ne sont pas limités en taille.</p>
      <p>Ces caches permettent toutes les opérations relationnelles : accès aux objets, aux listes, jointures entre modèles, etc.</p>
      <p>Les clés primaires de ces caches sont les uid, créés explicitement par les clients, pour ne pas avoir de conflit entre les identifiants créés offline par différents clients</p>
      <p>Le client possède également un cache Indexedb appelé `metadata` qui associe à chaque uid des attributs ‘createdAt’, ‘updatedAt’ et ‘deletedAt’</p>

      <p>Toutes les opérations sont effectuées, d’abord sur ces caches (optimistic updates), puis envoyées à la base de données</p>
      <p>Les clients doivent expliciter le périmètre de leur synchronisation. Ils ne veulent pas être synchronisés avec toute la BD, seulement avec la partie qui les concerne. Ils le font en précisant les clauses ‘where’ des requêtes de base de données pour les données qui les concernent.</p>
      <p>Les opérations de base de données donnent lieu à l’envoi d’événements vers les clients, qui peuvent mettre à jour leurs caches en temps-réel. Grace à ces mises à jour en continu, un client qui part d’un état synchronisé avec le serveur, reste synchrone tant qu’il n’y a pas de déconnexion, quelles que soient les opérations que lui ou les autres clients réalisent</p>
      <p>Le client peut donc toujours considérer que la source de vérité est le contenu de ses caches, après un temps de resynchronisation</p>

      <p>À chaque reconnexion (y compris au démarrage), pour chaque table, et pour chaque requête `where` de son périmètre de synchronisation, le client demande une synchronisation au serveur</p>
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
      <p>À l’issue de la synchronisation, le serveur et le client sont dans le même état du point de vue des valeurs relatives à la requête ‘where’</p>
      <p>Le service de synchronisation côté serveur est en exclusion mutuelle pour que les demandes synchronisation provenant des clients ne se chevauchent pas</p>
   </div>
</template>

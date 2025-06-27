# Offline

# BUG
- fenêtre #1 en offline sur iPhone, fenêtre #2 en online sur Firefox
- supprimer un groupe qui contient un user dans la fenêtre #1
- visualiser la liste des users dans la fenêtre #2 : le user et son appartenance au groupe sont visibles
- mettre la fenêtre #1 en online : dans la fenêtre #2 le user est toujours visible avec son groupe, ce qui est incorrect.
Après inspection, le groupe a été supprimé dans l'indexedb de la fenêtre #1, mais pas la relation user-group. Dans la base de données tout est normal.


- Les clients ont des caches dénormalisés pour chaque table/modèle
- Ces caches permettent toutes les opérations relationnelles : accès aux objets, aux listes, jointures entre modèles, etc.
- Les clés de ces caches sont des uid, créés explicitement par les clients, pour ne pas avoir de conflit entre les identifiants créés offline par différents clients
- Toutes les valeurs possèdent des attributs ‘createdAt’ et ‘updatedAt’
- Toutes les opérations sont effectuées, d’abord sur ces caches (optimistic updates), puis envoyées à la base de données
- Les clients doivent expliciter le périmètre de leur synchronisation. Ils ne veulent pas être synchronisés avec toute la BD, seulement avec la partie qui les concerne. Ils le font en précisant les clauses ‘where’ des requêtes de base de données pour les données qui les concernent.
- Les opérations de base de données donnent lieu à l’envoi d’événements vers les clients, qui peuvent mettre à jour leurs caches en temps-réel. Grace à ces mises à jour en continu, un client qui part d’un état synchronisé avec le serveur, reste synchrone tant qu’il n’y a pas de déconnexion, quelles que soient les opérations que lui ou les autres clients réalisent
- Le client peut donc toujours considérer que la source de vérité est le contenu de ses caches

- À chaque reconnexion (y compris au démarrage), pour chaque table, et pour chaque requête `where`, le client demande une synchronisation au serveur
- Le service de synchronisation reçoit :
    - La requête ‘where’
    - Les clés/valeurs des caches du client associées à la requête
    - La date de ‘cutoff’ (dernière déconnexion)
- Le service de synchronisation :
    - Calcule les couples clé/valeur de la base de données associés à la requête ‘where’
    - Compare avec ceux reçus du client, relativement à la date de cutoff
    - Il réalise dans la base de données les changements nécessaires
    - Il renvoie au client les changements nécessaires de son cache
- A l’issue de la synchronisation, le serveur et le client sont dans le même état du point de vue des valeurs relatives à la requête ‘where’

- Dans le cas de relations many-many, les tables intermédiaires doivent être explicites et les caches et modèles associés doivent être également explicitement synchronisés 

- Lorsqu’un client supprime une donnée lorsqu’il est offline, il la marque avec deleted_at=now sans la supprimer du cache,
sinon le serveur ne pourrait pas savoir que le client a demandé à la supprimer (est-ce important ? À vérifier)



# Tutorial

## Sans temps-réel, sans offline-résilience

Sans temps-réel ni offline, obtenir tous les événements de tous les documents d'un utilisateur `user_uid` est simple :
```
SELECT e.* from user_document_event as e, user_document as d where d.user_uid = user_uid and e.document_uid = d.uid;
```

## Avec temps-réel, sans offline-résilience

## Avec temps-réel et avec offline-résilience

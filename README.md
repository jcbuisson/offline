# Offline

- Les clients ont des caches dénormalisés pour chaque table/modèle
- Ces caches permettent toutes les opérations relationnelles : accès aux objets, aux listes, jointures entre modèles, etc.
- Les clés de ces caches sont des uid, créés explicitement par les clients, pour ne pas avoir de conflit entre les identifiants créés offline par différents clients
- on utilise des uuidv7 (croissants) pour améliorer les performances des indexes de la base de données
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


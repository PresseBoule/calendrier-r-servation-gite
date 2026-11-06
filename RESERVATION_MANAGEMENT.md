# Gestion des réservations

Ce dépôt publie le calendrier https://reservation-gitedusoulor-bain-sauna.netlify.app/.
Les lectures publiques et les créations passent par make-server-2b20b999, afin de respecter les annulations et restaurations depuis le cadenas du site principal. Les coordonnées ne sont plus lues publiquement. Les groupes de créneaux sont créés dans une transaction unique.

Les horaires de midi à 2h, les dates civiles locales, la limite de deux heures consécutives et EmailJS sont conservés. Les créneaux historiques du matin restent lisibles pour la gestion ; les nouvelles créations du matin sont refusées.

Le backend Supabase est déployé séparément depuis supabase/functions/server/index.tsx. Il dépend des transactions SQL définies dans le dépôt PresseBoule/les-gites-du-soulor. Après publication du nouveau frontend, appliquer la migration de protection des tables de réservations de ce dépôt principal.

Validation : npm test et npm run build. Aucun email de test ni réservation réelle n’est créé par la suite de tests.

# Sécurité de Rennes VTC : les 7 portes

Dernier audit : 22/11/2026. À refaire avant chaque mise en ligne et après chaque grosse modification faite par l'IA.

## Tout relancer (une commande)

Depuis le dossier `backend` :

```
npm run securite
```

- Par défaut, ça démarre une copie locale du serveur (tâches de fond coupées) et la teste avec la vraie base.
- Pour tester le serveur en ligne : `BACKEND_URL=https://app-rennesvtc.onrender.com npm run securite` (le test de plantage est alors ignoré).
- Le test crée 4 comptes jetables (`secu-…@rennesvtc-test.local`) et quelques courses « TEST SECURITE », puis les supprime. Il n'utilise jamais les données de vrais clients.
- Résultat attendu : **tous les tests passent** (« pass 14 / fail 0 »). Un test rouge = une porte ouverte.

## État des 7 portes

| # | Porte | État | Ce qui la garde fermée | Test |
|---|---|---|---|---|
| 1 | Ce que le navigateur montre | Fermée | Aucun secret dans les pages ni dans les applis ; en-têtes de sécurité (anti-iframe, HSTS, nosniff) ; accès entre sites limité à rennesvtc.com | 1a, 1b |
| 2 | La clé d'IA | Fermée (sans objet) | Aucune IA dans l'appli. La clé Google Maps reste sur le serveur uniquement | 1b |
| 3 | Sécurité ligne par ligne (RLS) | Fermée | RLS active sur les 17 tables ; trigger `rides_guard_columns` (migration 057) ; adresse admin et plaques non publiques | 3a, 3c, 3d, 3e, 4a |
| 4 | À qui appartient chaque donnée | Fermée | Contrôle du propriétaire sur toutes les routes ; routes `notify` réservées aux personnes concernées ; prix recalculé par le serveur | 3b, 4b, 4c |
| 5 | L'espace admin | Fermée | `requireAdmin` (session + rôle lus côté serveur) sur toutes les routes `/admin/*` | 5a |
| 6 | Limites à l'inscription et abus | Fermée côté serveur / à vérifier côté Supabase | Limites d'appels sur réservation web, estimation, notifications, chat, devis, invitations ; serveur qui ne plante plus sur une requête piégée. L'e-mail doit être confirmé avant connexion | 6a, 6b, 6c |
| 7 | Webhook de paiement | Sans objet | Aucun paiement en ligne, donc aucun webhook. **À refaire le jour où un paiement en ligne est ajouté** (signature, événements trop vieux, doublons) | – |

## Ce qui reste à faire à la main (hors code)

1. **Google Cloud** : sur la clé Maps, restreindre aux API utilisées (Directions, Places) et fixer un **plafond de dépense quotidien**.
2. **Supabase > Authentication > Rate Limits** : vérifier les limites d'inscription, de connexion et d'envoi d'e-mails ; activer la protection contre les mots de passe compromis si disponible.
3. **Render > Environment** : ajouter `LINK_SECRET` (une longue valeur aléatoire) pour signer les liens du bon de commande et de la tablette avec un secret dédié. Les anciens liens déjà envoyés par e-mail continuent de marcher.
4. **Après toute fuite de clé** : la révoquer chez le fournisseur et en créer une nouvelle. La supprimer du code ne suffit pas.

## Règles à garder

- Aucune clé, aucun mot de passe dans le code, les messages ou les rapports.
- Le prix d'une course est toujours recalculé par le serveur ; un client ne peut pas se donner un statut, un chauffeur ou un prix.
- Toute nouvelle route qui reçoit l'identifiant d'une course, d'un client ou d'un fichier doit vérifier que l'appelant en est propriétaire (ou admin).
- Toute nouvelle route publique (sans connexion) doit avoir une limite d'appels (`limit(...)` dans `backend/src/security.js`).
- Tout changement des règles de la base passe par un fichier `supabase/NNN_….sql` et un test dans `backend/tests/securite.test.js`.

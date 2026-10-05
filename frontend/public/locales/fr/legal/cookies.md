# Politique relative aux cookies et technologies similaires

**Date d’entrée en vigueur proposée :** 1er octobre 2026

## 1. Champ d’application

La présente politique explique l’utilisation des cookies et des technologies similaires sur les interfaces web de CoopData.

## 2. Technologies essentielles

CoopData peut utiliser des technologies strictement nécessaires pour l’authentification, la gestion des sessions, la sécurité, la répartition de charge et les préférences des utilisateurs. Ces technologies sont indispensables aux fonctionnalités de base et ne sont pas destinées à la publicité.

## 3. Technologies facultatives

Si des technologies d’analyse, de suivi des performances, de contenu intégré ou d’autres technologies non essentielles sont introduites, elles devraient être documentées et, lorsque cela est requis, soumises à un mécanisme de consentement approprié avant leur activation.

## 4. Informations sur les cookies

CoopData utilise actuellement uniquement les technologies essentielles énumérées ci-dessous. Elle n’utilise pas de cookies d’analyse, de publicité ni de suivi par des tiers.

### Cookies

| Nom | Finalité | Fournisseur | Durée | Type | Statut de consentement |
|---|---|---|---|---|---|
| `AUTH_SESSION_ID` | Suit une connexion en cours | Interne (service de connexion CoopData) | Jusqu’à la fermeture du navigateur | Session | Essentiel |
| `KC_AUTH_SESSION_HASH` | Protège le processus de connexion contre toute manipulation | Interne (service de connexion CoopData) | Quelques minutes, pendant la connexion | Session | Essentiel |
| `KC_RESTART` | Permet de reprendre une connexion interrompue | Interne (service de connexion CoopData) | Jusqu’à la fin de la connexion ou son expiration | Session | Essentiel |
| `KEYCLOAK_IDENTITY` | Maintient l’utilisateur connecté de manière sécurisée | Interne (service de connexion CoopData) | Jusqu’à la déconnexion ou l’expiration de la session (après 30 minutes d’inactivité, au plus 10 heures) ; plus longtemps si « Se souvenir de moi » est sélectionné | Session, ou persistant avec « Se souvenir de moi » | Essentiel |
| `KEYCLOAK_SESSION` | Identifie la session de connexion active | Interne (service de connexion CoopData) | Jusqu’à la déconnexion ou l’expiration de la session (après 30 minutes d’inactivité, au plus 10 heures) ; plus longtemps si « Se souvenir de moi » est sélectionné | Session, ou persistant avec « Se souvenir de moi » | Essentiel |
| `KEYCLOAK_LOCALE` | Mémorise la langue choisie sur la page de connexion | Interne (service de connexion CoopData) | Jusqu’à la fermeture du navigateur | Session | Essentiel (préférence) |
| `sidebar_state` | Mémorise si le menu de navigation est ouvert ou réduit | Interne | 7 jours | Persistant | Essentiel (préférence) |

### Technologies similaires (stockage du navigateur)

| Nom | Finalité | Fournisseur | Durée | Type | Statut de consentement |
|---|---|---|---|---|---|
| `i18nextLng` | Mémorise la langue choisie pour l’interface | Interne | Jusqu’à l’effacement des données du navigateur | Persistant (stockage local) | Essentiel (préférence) |
| `coopdata_theme` | Mémorise le choix d’affichage clair/sombre | Interne | Jusqu’à l’effacement des données du navigateur | Persistant (stockage local) | Essentiel (préférence) |
| `coopdata_cookie_consent` | Enregistre le choix effectué dans le bandeau cookies | Interne | Jusqu’à l’effacement des données du navigateur | Persistant (stockage local) | Essentiel |
| `coopdata_user_profile` | Conserve une copie du profil de l’utilisateur connecté afin que la Plateforme fonctionne hors ligne | Interne | Jusqu’à la déconnexion ou l’effacement des données du navigateur | Persistant (stockage local) | Essentiel |
| `coopdata_draft_financial` | Conserve un brouillon de saisie financière non envoyé afin que le travail ne soit pas perdu | Interne | Jusqu’à l’envoi ou l’abandon du brouillon | Persistant (stockage local) | Essentiel |
| `coopdata:period-reminders-dismissed` | Mémorise les rappels de déclaration ignorés par l’utilisateur | Interne | Jusqu’à l’effacement des données du navigateur | Persistant (stockage local) | Essentiel (préférence) |
| `CoopDataOfflineDB` | Stocke les données et les soumissions en attente afin que la Plateforme fonctionne sans connexion | Interne | Jusqu’à la synchronisation, la déconnexion ou l’effacement des données du navigateur | Persistant (IndexedDB) | Essentiel |
| `coopdata_tokens` | Conserve les jetons de connexion nécessaires au travail hors ligne | Interne | Jusqu’à la déconnexion | Persistant (IndexedDB) | Essentiel |
| `coopdata_query_cache` | Met en cache les données récemment consultées pour un chargement plus rapide, y compris hors ligne | Interne | Jusqu’à l’effacement des données du navigateur | Persistant (IndexedDB) | Essentiel |
| Cache applicatif hors ligne | Stocke les fichiers de l’application afin que la Plateforme puisse démarrer sans connexion | Interne | Jusqu’à la prochaine mise à jour de l’application | Persistant (cache du service worker) | Essentiel |

## 5. Gestion des préférences

Le cas échéant, les Utilisateurs peuvent gérer leurs préférences en matière de cookies non essentiels via l’interface de consentement de la Plateforme ou les paramètres de leur navigateur. La désactivation des technologies essentielles peut affecter le fonctionnement de la Plateforme.

## 6. Mises à jour

La présente politique devrait être mise à jour chaque fois que les technologies de cookies, les fournisseurs d’analyse ou les mécanismes de suivi changent de manière importante.

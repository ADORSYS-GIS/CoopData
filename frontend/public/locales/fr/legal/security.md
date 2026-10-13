# Déclaration de sécurité et de protection des données

**Date d’entrée en vigueur proposée :** 1er octobre 2026

## 1. Objet

La présente déclaration résume les mesures de sécurité appliquées à CoopData. Elle est volontairement rédigée à un niveau adapté aux utilisateurs et aux clients et ne divulgue pas de détails de mise en œuvre sensibles susceptibles d’accroître les risques de sécurité.

## 2. Contrôle d’accès

- Accès fondé sur les rôles et principe du moindre privilège.
- Comptes utilisateurs individuels et privilèges administratifs contrôlés.
- Contrôles d’authentification et, lorsqu’elle est disponible, authentification multifacteur pour les accès privilégiés ou sensibles.
- Revue périodique des droits d’accès et retrait des accès lorsqu’ils ne sont plus nécessaires.

## 3. Chiffrement

- TLS ou un transport sécurisé équivalent est utilisé pour les communications prises en charge en transit.
- Les données au repos devraient être chiffrées à l’aide de mesures reconnues par le secteur, avec AES-256 ou un équivalent lorsque cela est techniquement applicable.
- Les secrets, mots de passe et clés cryptographiques sont conservés et gérés à l’aide de mécanismes sécurisés appropriés plutôt qu’en clair.

## 4. Journalisation et surveillance

Les événements pertinents pour la sécurité, tels que l’authentification, les modifications d’autorisations, les actions administratives et les erreurs système, peuvent être journalisés à des fins de sécurité, de diagnostic et d’audit. L’accès aux journaux est contrôlé et ceux-ci sont conservés conformément au Calendrier de conservation et d’effacement.

## 5. Sauvegarde et reprise

- Des sauvegardes régulières sont effectuées conformément au plan de reprise approuvé.
- L’accès aux sauvegardes est contrôlé et elles sont protégées contre toute modification non autorisée.
- Les procédures de reprise devraient être testées périodiquement.
- La conservation des sauvegardes suit le calendrier de conservation approuvé.

## 6. Gestion des vulnérabilités et des changements

L’équipe d’ingénierie devrait appliquer un déploiement contrôlé, une gestion des dépendances, la correction des vulnérabilités, la revue de code et des tests proportionnés au risque de la Plateforme. Les changements sensibles pour la sécurité devraient être documentés et examinés avant leur mise en production.

## 7. Réponse aux incidents

CoopData dispose d’un processus de réponse aux incidents en cas de suspicion d’accès non autorisé, de perte, de divulgation, d’altération ou d’indisponibilité des données. Les incidents sont évalués, contenus, analysés, corrigés et documentés. Lorsque la loi ou le contrat l’exige, les Clients, autorités de régulation ou personnes concernés seront informés dans le délai applicable.

## 8. Prestataires tiers

Les prestataires d’hébergement infonuagique, d’authentification, de communication, d’analyse et d’autres services peuvent traiter des informations pour le compte de CoopData. Les prestataires concernés devraient être évalués en matière de sécurité, de confidentialité, de contrôle d’accès et d’obligations de traitement des données, et inscrits dans un registre interne des sous-traitants/fournisseurs.

## 9. Limites de la sécurité

Aucun service connecté à Internet ne peut garantir une sécurité absolue. Les Utilisateurs doivent protéger leurs identifiants, utiliser des appareils pris en charge et signaler rapidement toute compromission présumée.

## 10. Contact

- **Contact sécurité/confidentialité :** eswatini@dgrv.coop
- **Organisation :** DGRV, Confédération allemande des coopératives et Raiffeisen (German Cooperative and Raiffeisen Confederation)

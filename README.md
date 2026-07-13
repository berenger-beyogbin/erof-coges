# EROF COGES

**Évaluation Rapide Organisationnelle et Fonctionnelle des COGES (Comités de Gestion des Établissements Scolaires)**

Cette application web professionnelle permet aux enquêteurs de terrain de collecter le formulaire d'évaluation EROF COGES, de calculer de manière automatique les scores de fonctionnalité par COGES et de permettre aux superviseurs (DRENA, IEPP, DAPS-COGES) de suivre, valider et exporter les résultats sous forme de rapports.

---

## Fonctionnalités Principales

1. **Authentification Intégrée** : Connexion via Supabase Auth avec contrôle d'activation de compte (`is_active`).
2. **Collecte Multi-sections** : 20 sections et 111 questions modèles couvrant l'ensemble des aspects de gestion du COGES.
3. **Calcul Automatique des Scores** : Algorithme robuste basé sur les pondérations officielles de la DAPS-COGES.
4. **Tableau de Bord Décisionnel** : Visualisation des performances par axe, taux de preuves documentaires et filtres géographiques (DRENA, IEPP).
5. **Exports Complets** : Téléchargement instantané des données brutes, des synthèses de scores et des preuves auditées en CSV.

---

## Configuration de Supabase

Pour connecter cette application à votre projet Supabase existant :

> Le schéma reproductible, le seed minimal et les Edge Functions sont versionnés dans `supabase/`. Voir `docs/SUPABASE_SETUP.md` pour la procédure complète.

1. Définissez les variables d'environnement dans votre fichier `.env` ou configurez-les directement dans l'interface de déploiement de l'application :

```env
VITE_SUPABASE_URL="https://votre-projet.supabase.co"
VITE_SUPABASE_ANON_KEY="votre-cle-anonyme-publique"
```

2. Assurez-vous que les tables suivantes sont présentes et configurées dans votre base de données Supabase :
   - `users` (profils des utilisateurs avec colonne `is_active` booléenne)
   - `drenas` (Directions Régionales)
   - `iepps` (Circonscriptions d'Inspection)
   - `etablissements` (Écoles)
   - `coges` (Comités de Gestion)
   - `evaluations` (Formulaires de collecte)
   - `evaluation_reponses` (Réponses individuelles EAV)
   - `membres_be` (Membres du Bureau Exécutif)
   - `preuves_documentaires` (Preuves auditées de section 17)
   - `equipes_evaluation` (Membres de l'équipe de collecte de section 20)
   - `recommandations` (Forces, faiblesses et actions prioritaires de section 19)

---

## Mode Démo Local

Si aucune variable `VITE_SUPABASE_URL` n'est configurée, l'application bascule automatiquement en **Mode Démo Local** sécurisé pour permettre le test de l'interface et du formulaire de collecte hors ligne.

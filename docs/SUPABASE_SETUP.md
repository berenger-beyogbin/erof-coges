# Supabase Setup - EROF COGES

Ce dossier rend l'infrastructure Supabase reproductible pour le front React.

## Ce qui est versionne

- `supabase/migrations/202607130001_initial_schema.sql`
  - tables applicatives
  - contraintes et index
  - RLS
  - bucket prive `preuves-erof`
  - trigger de creation du profil `public.users` lors d'une inscription enqueteur
- `supabase/seed.sql`
  - DRENA de base
  - une IEPP de test par DRENA
  - une campagne pilote ouverte
- `supabase/functions/admin-create-user`
  - creation d'utilisateurs par un admin national
- `supabase/functions/admin-reset-password`
  - reinitialisation de mot de passe par un admin national

## Tables attendues par le front

- `users`
- `drenas`
- `iepps`
- `etablissements`
- `coges`
- `campagnes`
- `evaluations`
- `evaluation_reponses`
- `membres_be`
- `preuves_documentaires`
- `equipes_evaluation`
- `recommandations`
- `evaluation_scores`
- `audit_logs`

## Installation sur un projet Supabase neuf

### Chemin rapide avec le script PowerShell

Ajoutez d'abord ces valeurs dans `.env` :

```env
SUPABASE_ACCESS_TOKEN="..."
SUPABASE_DB_PASSWORD="..."
SUPABASE_SERVICE_ROLE_KEY="..."
```

Puis lancez :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-supabase.ps1
```

Le script :

- deduit le project ref depuis `VITE_SUPABASE_URL`
- lie le repo au projet Supabase
- pousse les migrations
- deploie `admin-create-user` et `admin-reset-password` avec `--use-api`, sans Docker

Note : `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` sont des variables reservees/fournies par Supabase dans le runtime Edge Functions. Le script verifie seulement la presence locale de la service-role key pour l'operateur, mais ne tente pas de la pousser avec `supabase secrets set`.

Pour un projet neuf ou une base de test vide, ajoutez `-IncludeSeed` pour pousser aussi le seed minimal :

```powershell
powershell -ExecutionPolicy Bypass -File scripts/deploy-supabase.ps1 -IncludeSeed
```

### Chemin manuel

1. Lier le repo a un projet Supabase.

```bash
supabase link --project-ref <PROJECT_REF>
```

2. Appliquer les migrations.

```bash
supabase db push
```

3. Charger le seed minimal si necessaire.

Pour un environnement local Supabase, `supabase db reset` rejoue les migrations et le seed.

Pour un projet distant, lancer le contenu de `supabase/seed.sql` dans le SQL editor Supabase si votre CLI ne pousse pas le seed automatiquement.

4. Deployer les fonctions.

```bash
supabase functions deploy admin-create-user
supabase functions deploy admin-reset-password
```

5. Configurer le front dans `.env`.

```env
VITE_SUPABASE_URL="https://<PROJECT_REF>.supabase.co"
VITE_SUPABASE_ANON_KEY="<ANON_KEY>"
```

## Bootstrap du premier admin

Le premier admin ne peut pas etre cree depuis l'application, car l'ecran de gestion des utilisateurs exige deja un `admin_national`.

Procedure simple:

1. Creer un utilisateur dans Supabase Auth depuis le dashboard.
2. Copier son `auth.users.id`.
3. Executer cette requete SQL en remplacant les valeurs.

```sql
insert into public.users (id, email, nom, prenom, role, actif)
values (
  'AUTH_USER_UUID',
  'admin@example.ci',
  'ADMIN',
  'NATIONAL',
  'admin_national',
  true
)
on conflict (id) do update set
  email = excluded.email,
  nom = excluded.nom,
  prenom = excluded.prenom,
  role = 'admin_national',
  actif = true;
```

Ensuite, connectez-vous avec cet admin et utilisez l'onglet `Utilisateurs`.

## Parcours de verification

1. Connexion admin.
2. Verifier qu'une campagne est ouverte dans `Campagnes`.
3. Creer un utilisateur enqueteur.
4. Connexion enqueteur.
5. Creer une nouvelle evaluation.
6. Enregistrer un brouillon.
7. Remplir les 20 sections.
8. Soumettre.
9. Verifier le score dans le dashboard.
10. Tester les exports CSV.

## Points a surveiller

- Le seed IEPP est volontairement minimal. Il faudra remplacer les IEPP par le referentiel officiel.
- L'upload de preuves utilise le prefixe `<evaluation_id>/<fichier>` dans le bucket `preuves-erof`.
- Les scores sont encore calcules cote front si aucun trigger SQL officiel ne les produit.
- Le mode demo local reste utile pour l'interface, mais le vrai parcours cible est Supabase.

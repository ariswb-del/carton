# Carton Plein

Jeu de collection de musique physique virtuelle : on ouvre des cartons de disques, on collectionne vinyles, CD, K7 et 8-track avec leurs vraies pochettes Discogs, on échange avec ses amis et on voit ce qui tourne dans sa ville.

- **Site** : Next.js 14, hébergé sur Vercel.
- **Base de données et comptes** : Supabase (Postgres + connexion par lien magique).
- **Données musicales** : API Discogs, synchronisée toutes les 6 heures par GitHub Actions.

Toutes les règles du jeu (tirage des cartons, échanges) tournent dans la base, côté serveur : un joueur ne peut ni s'ajouter des cartons, ni se créer des disques, ni échanger un disque qui n'est pas à lui.

---

## Mise en ligne, étape par étape

Compte environ 45 minutes la première fois, dont 25 à 30 minutes d'attente pendant que le catalogue se remplit.

### 1. Clé Discogs

1. Sur discogs.com, connecté à ton compte : **Paramètres > Développeurs** (discogs.com/settings/developers).
2. **Create an application**. Nom : Carton Plein. Description : jeu de collection non commercial.
3. Note la **Consumer Key** et le **Consumer Secret**. Ils ne vont que dans GitHub (étape 3), nulle part ailleurs.

### 2. Supabase

1. Sur supabase.com : **New project**. Région : **West EU (Paris)**. Choisis un mot de passe de base de données et garde-le de côté.
2. Une fois le projet prêt, menu de gauche **SQL Editor > New query**. Colle tout le contenu du fichier `supabase/migrations/001_init.sql`, puis **Run**. Le message attendu : « Success. No rows returned ».
3. **Project Settings > API**. Note trois valeurs :
   - **Project URL** (de la forme `https://xxxx.supabase.co`)
   - **anon public** (clé publique, elle ira dans Vercel)
   - **service_role** (clé secrète, elle n'ira que dans GitHub, jamais dans Vercel)

### 3. GitHub

1. Crée un dépôt **public** nommé `carton-plein`. Public, parce que les automatisations y sont gratuites et illimitées ; en privé, elles sont plafonnées à 2 000 minutes par mois, et la synchronisation en consomme environ 1 900. Aucune clé n'est dans le code, elles restent dans les « secrets » du dépôt.
2. Envoie le code dans ce dépôt (Claude peut le faire pour toi si tu lui donnes le nom du dépôt).
3. Dans le dépôt : **Settings > Secrets and variables > Actions > New repository secret**, quatre fois :

   | Nom | Valeur |
   |---|---|
   | `DISCOGS_KEY` | Consumer Key Discogs |
   | `DISCOGS_SECRET` | Consumer Secret Discogs |
   | `SUPABASE_URL` | Project URL Supabase |
   | `SUPABASE_SERVICE_ROLE_KEY` | clé service_role Supabase |

4. Onglet **Actions** > **Synchroniser Discogs** > **Run workflow**. Le premier passage dure 25 à 30 minutes (Discogs limite à 60 requêtes par minute). Les suivants se lancent seuls toutes les 6 heures.

### 4. Vercel

1. Sur vercel.com : **Add New > Project**, importe le dépôt `carton-plein`.
2. Avant de déployer, ouvre **Environment Variables** et ajoute :

   | Nom | Valeur |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL Supabase |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | clé anon public Supabase |

3. **Deploy**. Note l'adresse du site (par exemple `carton-plein.vercel.app`).

### 5. Brancher la connexion par e-mail

Dans Supabase : **Authentication > URL Configuration**.

- **Site URL** : l'adresse Vercel, par exemple `https://carton-plein.vercel.app`
- **Redirect URLs** : ajoute `https://carton-plein.vercel.app/auth/callback`

### 6. Afficher le code de connexion dans l'e-mail

Les joueurs se connectent avec un code à 6 chiffres reçu par e-mail. Dans Supabase : **Authentication > Emails > Templates > Magic Link**. Remplace le contenu du message par :

```html
<h2>Ton code Carton Plein</h2>
<p style="font-size:28px;letter-spacing:6px"><b>{{ .Token }}</b></p>
<p>Tape ce code sur le site. Il expire dans une heure.</p>
```

Puis **Save**.

### 7. Tester

Ouvre le site, saisis ton e-mail, tape le code reçu, choisis ton pseudo et ta ville : trois cartons t'attendent.

---

## Points de vigilance

- **E-mails de connexion (obligatoire).** Le service d'e-mail intégré à Supabase n'écrit qu'aux membres de ton équipe Supabase, et 2 fois par heure au maximum. Pour que d'autres joueurs puissent se connecter, branche un service d'envoi (Brevo, offre gratuite de 300 e-mails par jour) dans **Authentication > Emails > SMTP Settings**.
- **Mise en pause Supabase.** Un projet gratuit est mis en pause après une semaine d'inactivité. La synchronisation toutes les 6 heures sollicite la base, ce qui devrait suffire à la garder active ; si le site affiche une erreur après une longue pause, relance le projet depuis le tableau de bord Supabase.
- **Conditions Discogs.** Les pochettes et les prix du marché sont des « données restreintes » : affichage autorisé pour faire tourner une application, mais pas d'usage commercial, pas de copie, et pas de données affichées plus de 6 heures après leur mise à jour chez Discogs (d'où la synchronisation toutes les 6 heures). Le pied de page porte la mention « Données fournies par Discogs » et l'avis de non-affiliation, comme l'exigent leurs conditions.
- **Droits sur les pochettes.** Elles appartiennent aux labels et aux artistes. Tant que le jeu reste gratuit et non commercial, l'affichage via l'API Discogs suit l'usage courant des applis de collection. Toute monétisation (cartons payants, publicité) demande un avis juridique et sans doute un accord avec Discogs ou les ayants droit.

## Faire évoluer le catalogue

La liste des albums est dans `data/catalog-seed.json` (identifiant Discogs du « master », drapeau `gem` pour les pépites). Ajoute une ligne, pousse le changement sur GitHub, puis relance **Synchroniser Discogs** : l'album entre dans les bacs avec ses quatre formats et ses raretés.

## Développement local

```bash
cp .env.example .env.local   # puis remplis les valeurs
npm install
npm run dev                  # http://localhost:3000
npm run sync -- --limit 5    # synchronise 5 albums pour tester
```

## Règles du jeu (référence)

- 3 cartons maximum en stock, un nouveau toutes les 3 heures, 5 disques par carton, le 5e au moins « Étagère ».
- Paliers : Bac à 1 € (50 %), Étagère (28 %), Vitrine (14,5 %), Coffre (6 %), Graal (1,5 %).
- Rareté d'un format = demande Discogs (want/have) + prix plancher + rareté réelle du format pour l'album. Un format jamais sorti devient un **pressage fantôme** (valeur × 1,5).
- État Goldmine tiré à l'ouverture (M 5 %, NM 20 %, VG+ 35 %, VG 25 %, G+ 15 %), visible sur l'objet et multiplicateur de valeur.
- Chaque exemplaire porte un numéro (n° 1 = premier exemplaire de ce disque dans ce format jamais sorti d'un carton).

# 🏨🔧 Caisse Panne Hôtel

A **hotel maintenance & breakdown logbook** — the digital replacement for the
paper *livre de panne* — as a **web app**: one link that works on phones,
tablets and PCs at the same time, with shared live data.

**React + TypeScript + Vite + Tailwind** in the browser, a small API
(`/api/rpc`, a Vercel function) and **Postgres on Supabase**. Phones can
install it from the browser ("Ajouter à l'écran d'accueil"), so no app store
or APK is needed.

## The workflow it is built around

```
Problème signalé → Ticket créé → Assigné → Diagnostic → Intervention
  → Pièces/matériel → Test → Résolu → Clôturé
```

That lifecycle lives on a single `pannes` row whose `status` is the source of
truth. Room and equipment status are only ever moved by the lifecycle
services (create / resolve / close), so the hotel view can never disagree
with the maintenance view.

## Running it locally

```bash
npm install
npm run seed:demo   # optional: demo hotel/rooms/equipment/tickets
npm run dev         # http://localhost:5175 (also reachable from a phone on the same Wi-Fi)
```

Without a `DATABASE_URL` the app uses an embedded local Postgres stored in
`data/pglite/`, so nothing needs to be installed or configured. Tables and the
default accounts are created automatically the first time the API runs.

## Putting it online (Supabase + Vercel, free tiers)

### 1. Supabase (the database)

1. Sign up at <https://supabase.com> → **New project**.
   - Region: pick one near the hotel, e.g. **West EU (Ireland)**. This matches `regions: ["dub1"]` in
     `vercel.json`; if you pick another region, change that too so the API and
     the database sit next to each other.
   - Database password: use **letters and digits only** (no `@ : / # ?`), so it can go in a URL without escaping.
2. Click **Connect** (top of the project) → **Transaction pooler** → copy the
   URI (`postgresql://postgres.xxxx:[YOUR-PASSWORD]@…pooler.supabase.com:6543/postgres`)
   and put your password in place of `[YOUR-PASSWORD]`. → this is `DATABASE_URL`.
3. **Project Settings → API**: copy the **Project URL** (`SUPABASE_URL`) and
   the **service_role / secret** key (`SUPABASE_SERVICE_ROLE_KEY`). This key
   is only used by the server to store ticket photos. Never put it in front-end code.

You don't need to create any tables. The app does that on its first request.

### 2. Vercel (the website + API)

```bash
npx vercel login        # opens the browser
npx vercel link         # create the project (accept the defaults)
```

In the Vercel dashboard → your project → **Settings → Environment Variables**,
add for *Production*:

| name | value |
|---|---|
| `DATABASE_URL` | from Supabase step 2 |
| `AUTH_SECRET` | any long random text (e.g. 40+ random characters). Changing it logs everyone out |
| `SUPABASE_URL` | from Supabase step 3 |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase step 3 |

Then deploy:

```bash
npx vercel --prod
```

It prints the public address (e.g. `https://hotel-panne-app.vercel.app`).
Re-run `npx vercel --prod` after any code change.

### 3. First login & phones

1. Open the address, log in as `admin` / `admin123`.
2. **Immediately** go to *Utilisateurs* and reset every default password. The
   app is now on the internet and anyone can reach the login page.
3. On each phone, open the address:
   - **Android (Chrome)**: menu ⋮ → *Ajouter à l'écran d'accueil* / *Installer l'application*.
   - **iPhone (Safari)**: Partager → *Sur l'écran d'accueil*.

### Moving data from the old desktop version

```bash
DATABASE_URL="postgresql://…" npm run import:sqlite path/to/hotel.db
```

This **replaces** everything in the target database. Photos are not carried
over, because they were files on the old PC.

### Backups

The Supabase free tier has no automatic backups. Use *Réglages → Sauvegarder*
regularly. It downloads a `.json` file of all the data (photos stay in
Supabase Storage; the file keeps their links). *Restaurer* replaces all data
for every user.

### Default logins (change them right after deploying)

| user | password | role |
|---|---|---|
| `admin` | `admin123` | Administrateur — accès complet |
| `manager` | `manager123` | Responsable maintenance — assignation, achats, rapports |
| `reception` | `reception123` | Réception — signalement de pannes |
| `housekeeping` | `housekeeping123` | Housekeeping — signalement de pannes chambres |
| `technicien` | `technicien123` | Technicien maintenance — répond aux tickets Maintenance (ne crée pas de tickets) |
| `informatique` | `informatique123` | Informatique (IT) — répond aux tickets IT (ne crée pas de tickets) |

These accounts are only created on an empty database. On an existing one,
create the IT account from *Utilisateurs* (rôle « Informatique (IT) »).

### Who can do what on tickets

| | Create | See | Comment | Status |
|---|---|---|---|---|
| Admin, Responsable | ✓ | all | ✓ | all, assign, close, cancel |
| Réception, Housekeeping | ✓ | all | ✓ (e.g. answer an info request) | — |
| Technicien maintenance | — | Maintenance tickets + assigned to them | ✓ | En cours, Réparé, Besoin de pièce, Besoin d'infos, Escalader |
| Informatique (IT) | — | IT tickets + assigned to them | ✓ | same as maintenance |

A ticket goes to IT when its category is Wi-Fi / Réseau, Informatique,
Téléphonie or TV / IPTV, otherwise to Maintenance; the reporter can change it,
and an admin can transfer it from *Assigner*. All of this is checked by the
API, not only hidden in the UI.

## History & weekly PDF archive

Finished tickets (résolu / clôturé / annulé) stay in the app for 14 days after
their last activity (*Livre de panne → Terminés*). Every Monday at 02:00 UTC a
Vercel Cron job exports them to one PDF — summary, then each ticket with its
thread and small photos — stores it in the private `archives` Supabase
Storage bucket, and only then deletes those tickets and their photos.
Unfinished tickets are never deleted. Admins download the PDFs from
*Menu → Archives*, and can run it on demand there (« Archiver maintenant »).

**Setup:** in Vercel → Settings → Environment Variables add `CRON_SECRET`
(any long random string), then redeploy. Without it the weekly job refuses to
run (the « Archiver maintenant » button still works).

## Features (V1)

- **Livre de panne numérique** : ticket par panne (titre, description,
  catégorie, priorité, impact client), workflow à 9 statuts (ouverte →
  assignée → diagnostic → attente pièces → en réparation → test → résolue →
  clôturée / annulée), diagnostic + cause + action recommandée, historique
  des interventions (technicien, début/fin, résultat), photos, impression du
  rapport d'intervention.
- **Structure hôtel** : bâtiments, chambres (étage, type, statut), zones
  communes (réception, cuisine, buanderie, local technique, ascenseur,
  piscine, parking…). Une panne critique ou bloquant la chambre la passe
  automatiquement en maintenance ; elle redevient disponible à la clôture du
  dernier ticket ouvert qui la concernait.
- **Équipements** : fiche par équipement (catégorie, marque/modèle, N° série,
  installation, garantie), historique complet (pannes + entretiens
  préventifs) pour repérer les pannes récurrentes.
- **Maintenance préventive** : échéances récurrentes (jours/semaines/mois)
  par équipement, zone ou bâtiment, avec liste de contrôle ; la complétion
  reprogramme automatiquement la prochaine échéance.
- **Stock & pièces** : inventaire de pièces (quantité, seuil minimum, coût),
  mouvements (entrée/sortie/ajustement), alerte stock bas, bons de commande
  fournisseur avec réception qui met à jour le stock automatiquement.
- **Prestataires externes** : fiche société (contact, type de service,
  tarif), assignable directement sur un ticket au même titre qu'un
  technicien interne.
- **Coûts** : pièces + main d'œuvre + prestataire calculés automatiquement
  par ticket.
- **Rapports** : fréquence par catégorie, pannes par chambre, pannes par
  équipement, coûts, performance par technicien, temps moyen de résolution,
  journal quotidien imprimable, consignes de passation d'équipe.
- **Administration** : 5 rôles avec permissions, journal d'audit de toutes
  les actions sensibles, sauvegarde / restauration en un clic (fichier `.json`),
  chaque opération dans une transaction SQL — jamais de demi-écriture.

## Project layout

```
hotel/
  api/rpc.ts    Vercel function: POST /api/rpc {method, args} + Bearer token
  server/       runs on the server only
    db.ts          Postgres (pg pool, or embedded PGlite locally) + transactions
    schema.ts      Postgres schema, applied idempotently on cold start
    auth.ts        signed session tokens (the server never trusts a user id from the browser)
    rpc.ts         token check → handler dispatch
    handlers.ts    permission checks + every API method
    services.ts    transactional panne lifecycle + inventory + maintenance
    backup.ts      JSON export / restore
    photos.ts      ticket photos → Supabase Storage
    seed.ts        core data + optional --demo data
    importSqlite.ts  one-time import from the desktop version's hotel.db
  shared/       types.ts (+ PERMISSIONS), calc.ts — used by both sides
  src/          React app
    lib/api.ts     window.api → /api/rpc, plus browser photo/print/backup helpers
    pages/ components/ store/
  public/       PWA manifest + icons
```

## Not in V1 (natural V2)

Push notifications for new critical tickets, offline mode (service worker +
sync queue), guest-facing notifications, digital signatures on intervention
reports, accounting export formats, damage-diagram markup on photos.

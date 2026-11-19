# PRIMAL SCAN

Application mobile **privée** (iPhone + Android) de suivi nutritionnel : scanner, note Primal, note micronutritionnelle, journal, recettes, planification, statistiques.
Accès **uniquement sur invitation** (codes à usage unique) et **un seul appareil connecté par compte**.

Construite avec React Native / Expo (SDK 58), TypeScript, SQLite local (hors ligne d'abord) et Supabase (comptes, invitations, sessions, synchronisation).

---

## 1. État réel du projet (honnêteté d'abord)

| Domaine | État | Comment c'est vérifié |
|---|---|---|
| Invitations à usage unique, expiration, révocation, anti-course | ✅ fait | 22 tests sur un **vrai PostgreSQL** (`supabase/tests`), dont tests de mutation |
| Compte propriétaire sécurisé côté serveur | ✅ fait | idem |
| Un seul appareil actif, révocation immédiate, jeton ancien refusé | ✅ fait (SQL) | idem (tests I à P du cahier des charges) |
| Moteurs : calories, macros, micro, note Primal, notes agrégées, recettes | ✅ fait | 40+ tests unitaires |
| Stockage SQLite + synchronisation (dernier écrit gagne) | ✅ fait | tests avec SQLite réel (`node:sqlite`) |
| Politique de session hors ligne (48 h max) | ✅ fait | tests unitaires |
| Les 29 écrans | ✅ écrits, **compilent** (bundles Android + iOS générés) | `tsc` + `expo export` |
| **Exécution sur un vrai téléphone** | ⚠️ **jamais essayée** | je n'ai pas de téléphone ni d'émulateur dans mon environnement |
| **Supabase réel** (GoTrue, JWT) | ⚠️ **non essayé** : mes tests simulent `auth.users`, `auth.sessions` et `auth.jwt()` | à valider avec la checklist §6 |
| Open Food Facts | ⚠️ code écrit d'après l'API documentée, **non appelé** (réseau bloqué chez moi) ; convertisseur testé sur un exemple | scannez un produit au premier test |
| Base CIQUAL officielle | ⚠️ **non incluse** : liste de démarrage de ~30 aliments *indicatifs* + script d'import (non essayé sur le vrai fichier) | §5 |
| OCR (lecture des ingrédients) | ⚠️ ML Kit local, nécessite l'app installée (pas Expo Go), **non essayé** | |
| Comparaison de deux produits (§12 du cahier) | ❌ pas faite | |
| Chiffrement de la base SQLite au repos | ❌ pas fait (verrouillage applicatif seulement) | voir §7 |

Rien n'est présenté comme « terminé » s'il n'a pas été vérifié ci-dessus.

---

## 2. Coûts

| Élément | Coût |
|---|---|
| Android (APK à partager) | **0 €** |
| Supabase (offre gratuite) | 0 € — limites : 500 Mo de base, 50 000 utilisateurs actifs/mois, e-mails de test limités (quelques par heure). ⚠️ un projet gratuit est **mis en pause après 7 jours sans activité** (il se réveille depuis le tableau de bord). |
| Open Food Facts, ML Kit (OCR), calculs | 0 € (gratuits, locaux) |
| Builds EAS | offre gratuite (file d'attente, quota mensuel limité) |
| **iPhone installable par vos amis** | **Compte Apple Developer : 99 $/an** (obligatoire). Sans lui : installation possible uniquement sur *votre* iPhone via Xcode (Mac requis), expirant tous les 7 jours. Avec lui : build « ad hoc » jusqu'à 100 appareils (il faut enregistrer l'UDID de chaque iPhone) ou TestFlight. |

Aucun service payant n'est activé par le projet. Aucun appel d'IA n'est utilisé (assistant 100 % local).

---

## 3. Mise en route (débutant)

### A. Créer le projet Supabase (gratuit)
1. Créez un compte sur supabase.com → *New project* (notez le mot de passe de base, vous n'en aurez pas besoin dans l'app).
2. **SQL Editor** : collez et exécutez `supabase/migrations/0001_security.sql`, puis `0002_sync.sql`.
3. **Authentication → Providers → Email** : activez *Email*. Vous pouvez **désactiver « Confirm email »** (le code d'invitation est déjà le filtre) ; laissez les inscriptions **activées** (« Allow new users to sign up ») : c'est le code d'invitation, vérifié par un déclencheur SQL, qui bloque les inscriptions non invitées.
4. **Authentication → Email Templates → Reset Password** : collez `supabase/email-templates/recovery.html` (code à 6 chiffres).
5. **Project Settings → API** : copiez *Project URL* et la clé **anon**.

### B. Créer VOTRE compte propriétaire
1. Dans le SQL Editor : `select public.setup_owner('votre@email.com');`
2. **Authentication → Users → Add user** : créez l'utilisateur avec ce même e-mail et un mot de passe (cochez *Auto confirm*).
3. Faites cela **avant** de distribuer l'application. Seul cet e-mail peut devenir propriétaire, une seule fois ; le rôle n'existe que côté serveur.

### C. Configurer l'application
```bash
cp .env.example .env     # puis remplissez les 2 valeurs
npm install --legacy-peer-deps
npx expo start           # test rapide avec l'app Expo Go
```
(Expo Go : tout fonctionne sauf la lecture de texte OCR.)

### D. Créer les vrais fichiers d'installation
```bash
npm i -g eas-cli && eas login
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --value "https://xxxx.supabase.co" --environment preview --visibility plaintext
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "eyJ..." --environment preview --visibility plaintext
eas build -p android --profile preview     # → lien de téléchargement d'un APK à envoyer à vos amis
eas build -p ios --profile preview         # nécessite le compte Apple Developer (99 $/an)
```
La clé *anon* est publique par conception : elle est donc visible dans l'APK. La sécurité repose sur les règles SQL/RLS, pas sur ce secret. **Ne mettez jamais la clé `service_role` dans l'application.**
Posséder l'APK ne donne aucun accès : il faut un code d'invitation valide pour créer un compte.

### E. Inviter quelqu'un
Profil → *Gestion des invitations* → choisir la durée (7 jours par défaut) → *Créer un code* → copier/partager. Le code n'est affiché **qu'une fois** (le serveur ne garde que son empreinte).

---

## 4. Sécurité : comment ça marche

* **Invitations** : code `PRIMAL-XXXX-XXXX-XXXX` (60 bits aléatoires, `gen_random_bytes`), stocké sous forme de hash salé (poivre serveur). Un déclencheur `BEFORE INSERT` sur `auth.users` consomme le code par un `UPDATE … WHERE status='available'` : atomique, donc deux inscriptions simultanées ne peuvent pas partager un code ; si la création du compte échoue, le code n'est pas perdu.
* **Rôle propriétaire** : colonne `profiles.role`, non modifiable par l'utilisateur (permissions de colonne + aucune politique d'écriture) et jamais lue depuis les métadonnées. Toutes les fonctions `admin_*` vérifient `is_owner()`.
* **Un seul appareil** : table `device_sessions` (1 ligne par compte). À chaque connexion, `claim_device` (verrou de ligne → pas de course) enregistre la session du nouvel appareil et **supprime les autres sessions** (`auth.sessions` → leurs refresh tokens disparaissent). `claim_device` refuse aussi toute session déjà supprimée : un ancien jeton encore « frais » ne peut pas reprendre la place.
* **RLS** : les données privées (`sync_records`) exigent `is_active_session()` : l'ancien appareil est refusé **immédiatement** côté serveur, même si son jeton d'accès n'est pas encore expiré.
* **Côté application** : vérification toutes les 20 s au premier plan + au retour d'appli + à chaque refus du serveur. Perte d'autorisation → session locale effacée, synchro arrêtée, base fermée, écran « Votre compte PRIMAL SCAN a été connecté sur un autre appareil… » (aucune info sur le nouvel appareil).

## 5. Limites à connaître
* **Hors ligne** : un téléphone sans réseau ne peut pas savoir qu'il a été révoqué. Il reste utilisable **48 h maximum** après la dernière validation serveur (`OFFLINE_MAX_MS`), puis les données sont verrouillées jusqu'à une reconnexion. Une détection de retour en arrière de l'horloge est incluse.
* La base SQLite locale n'est **pas chiffrée** : le « verrouillage » est applicatif (la base n'est jamais ouverte sans session valide). Un téléphone débloqué/rooté expose les fichiers. Amélioration possible : SQLCipher.
* Les codes ont 60 bits d'entropie et sont protégés par les limites de débit de Supabase ; il n'y a pas de limitation de tentatives personnalisée.
* Le nombre de changements d'appareil n'est **pas** limité (comme demandé).
* La note Primal suit la philosophie *Primal Blueprint* (aliments entiers, bonnes graisses ; céréales, sucres, huiles de graines, ultra-transformés pénalisés). Les critères sont réglables (Paramètres › Critères Primal). Classement des additifs = indicatif, d'après avis publics, pas un avis médical.
* Les valeurs de référence micro sont approximatives (VNR UE / ANSES) et modifiables.

## 6. Checklist de validation (à faire au premier lancement)
1. Connexion propriétaire sur le téléphone A → l'accueil s'affiche (config initiale puis accueil).
2. Créer un code → créer un compte « ami » sur un téléphone B avec ce code ✔ ; réutiliser le code ✘.
3. Connecter le compte ami sur un téléphone C → **B affiche le message de déconnexion en ≤ 20 s** ; ses requêtes sont refusées.
4. Scanner un produit connu (ex. Nutella) → fiche avec notes ; produit inconnu → options photo/saisie.
5. Ajouter un repas hors ligne (mode avion) → reconnecter → vérifier la synchro (Paramètres › Synchronisation).
Si un point échoue (en particulier 3), c'est probablement une hypothèse sur GoTrue non couverte par mes tests : dites-le-moi avec le message d'erreur.

## 7. Base CIQUAL officielle
Téléchargez la table sur ciqual.anses.fr, exportez-la en CSV (`;`, UTF-8, une colonne par constituant), puis `npm run import:ciqual -- fichier.csv`. Le script reconnaît les colonnes par leur nom ; **vérifiez le rapport affiché** (non essayé sur le vrai fichier).

## 8. Développement
```bash
npm test                 # tous les tests (SQL réel : npm run pg:test:start avant, pg:test:stop après)
npm run typecheck
```
```
app/                 écrans (Expo Router) : (auth) · (app)/(tabs) · admin…
src/engines/         calories, macros, micro, note Primal, agrégation, recettes, assistant local
src/db/              SQLite (schéma, dépôt)         src/sync/   synchronisation
src/auth/            session, politique hors ligne  src/data/   Open Food Facts, OCR, CIQUAL
src/ui/              thème, composants animés        supabase/   migrations SQL + tests PostgreSQL réels
```

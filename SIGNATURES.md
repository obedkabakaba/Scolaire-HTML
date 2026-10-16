# Signatures des apparences

Chaque apparence d'Ardoise raconte désormais une histoire (quatorze apparences depuis l'arrivée de Pro et Savane). `theme-signatures.js`
et `theme-signatures.css` sont chargés par `theme.js` pour **toutes** les
apparences (jamais sur les pages publiques) et leur donnent :

- **un récit et une devise** — la devise vit dans la fiche de l'apparence
  (`theme.js`) et s'affiche dans Mon profil et dans l'Apparence du Super Admin ;
  le récit complet s'affiche sur l'accueil des apparences classiques et dans
  l'annonce qui apparaît quand on change d'apparence ;
- **une scène** : un décor animé et discret derrière le contenu ;
- **un widget** propre à l'apparence sur les pages d'accueil
  (`dashboard-directeur`, `espace-*`) ;
- **des gestes** : entrée des cartes, effet au clic, suivi du pointeur ;
- **un rideau** de transition quand on la choisit.

| Apparence (clé) | Histoire | Scène | Widget | Gestes |
|---|---|---|---|---|
| Ardoise (`ardoise`) | Le Tableau | poussière de craie, rail texturé, trait de craie sous l'écran actif | **Le mot du jour** écrit à la craie ; l'éponge l'efface et en écrit un autre | cartes dévoilées d'un coup d'éponge, poudre de craie au clic |
| Studio (`studio`) | L'Atelier | trame de points, projecteur indigo qui suit le pointeur | **Session de concentration** (25 min, mémorisée sur l'appareil) | halo sur la carte survolée |
| Pure (`pure`) | La Page blanche | colonnes de la grille suisse tracées à l'ouverture | **Registre du jour** : date, semaine ISO, avancée de l'année civile, scolaire et de la journée | cartes numérotées 01, 02… comme un registre |
| Nuit (`nuit`) | La Veillée | ciel étoilé, aurore, étoiles filantes | **Le ciel de ce soir** : vraie phase de la Lune (calculée) | entrée depuis l'obscurité, étoiles au clic |
| Terranga (`yohali`) | Teranga | soleil chaud, frise de wax | **Bienvenue** dans dix langues des familles (lingala, swahili, wolof…) | dévoilement chaleureux, pulsation au clic |
| Élan (`elan`) | L'Élan | soleil levant, traînées de vitesse | **Mes trois victoires du jour** à cocher ; gerbe de confettis à 3/3 | entrée lancée, étincelles au clic |
| Yohali (`perspective`) | L'Atelier d'architecte | lignes de fuite d'un plan | **Plan de la journée** : relevé au trait de 7 h à 18 h, repère de l'heure | cartes en relief qui s'inclinent sous le pointeur |
| Récré (`recre`) | La Récré | gribouillis dans la marge, avion en papier de passage | **Mon post-it** (sur l'appareil) et bouton « lancer un avion » | cartes-autocollants qui gigotent, étoiles de couleur au clic |
| Nexus (`nexus`) | Le Réseau | maillage, balayage, impulsions de données | **Console** : réseau en ligne/hors ligne, horloge, temps de chargement réel | entrée « glitch », titres qui scintillent |
| Orbite Aube (`orbite`) | L'Aube orbitale | anneaux et satellites ; le ciel change avec l'heure (aube, jour, crépuscule, nuit) | **Course du soleil** de 6 h à 18 h | cartes en apesanteur |
| Fluide (`fluide`) | Le Lagon | lagon vivant (nappes de couleur, caustiques) | **La journée se remplit** : un verre d'eau qui monte de 7 h à 17 h | verre liquide (voir FLUIDE.md), ondes au clic |
| Vibra (`vibra`) | Le Campus vibrant | constellation d'or (canevas) | **Pouls de l'école** : électrocardiogramme d'or et compteurs réels de l'écran | reflet d'or sur les cartes, pulsation au clic |
| Pro (`pro`) | Le Cockpit | quadrillage discret, radar bleu qui balaie le coin de l'écran | **Indicateurs clés** calculés depuis les compteurs de l'écran : élèves par classe, élèves par professeur, part des retards de paiement, moyenne ; liseré rouge au-delà d'un seuil | chiffres en chasse fixe, liseré bleu au survol, galon « PRO » sur la marque |
| Savane (`savane`) | L'Heure dorée | soleil couchant, acacias en ombre chinoise, oiseaux de passage, herbes dans le vent ; rail en ciel de crépuscule | **La marche de la semaine** : une empreinte par jour passé, le soleil sur aujourd'hui, les événements de l'écran posés sur leur jour | entrée dans la chaleur, étincelles au clic |

## Règles tenues

- Présentation pure et réversible : au changement d'apparence, la scène et le
  widget précédents sont retirés.
- Aucune requête métier, aucun chiffre inventé. Les widgets lisent l'heure, la
  date, l'état du réseau ou ce que l'écran affiche déjà (compteurs, événements).
  Ce que l'utilisateur écrit (post-it, victoires, minuteur) reste dans le
  `localStorage` de son appareil, par utilisateur.
- Une seule horloge d'une seconde, arrêtée quand l'onglet est caché ; la
  constellation de Vibra s'arrête aussi hors de l'apparence.
- `prefers-reduced-motion` fige scènes, entrées et effets ; rien n'est imprimé.
- Aucune animation d'entrée ne joue sur l'opacité (un audit de contraste lancé
  pendant l'entrée lirait sinon un texte pâli).

## Déconnexion : toujours atteignable

- **Correctif** : les rails flottants d'Orbite, Vibra et Fluide prenaient la
  hauteur de leur contenu malgré `top`/`bottom` ; sur un écran de moins de
  ~750 px de haut, « Sortir » passait sous le bord sans défilement possible.
  Leur hauteur maximale est maintenant bornée à l'écran (`theme.css`).
- **Garde-fou** : si une apparence venait un jour à masquer, recouvrir ou
  rejeter hors d'atteinte `#bouton-deconnexion-nav`, une commande « Se
  déconnecter » de secours apparaît en bas à gauche et clique le vrai bouton
  (même gestionnaire de session). Sur téléphone, la déconnexion reste dans le
  tiroir.
- **Super Admin** : le rail des domaines défile désormais (les domaines
  défilent, le pied — recherche, Apparence, compte — reste toujours visible) et
  gagne un bouton « Se déconnecter » direct. Les infobulles sont dessinées en
  position fixe pour ne pas être coupées par le défilement.

## Première connexion

À la toute première connexion d'une personne (inscription d'une école,
nouveau compte), la page d'arrivée joue une courte animation d'accueil aux
couleurs de l'apparence : le nom « Ardoıse » se dessine, le point du « i »
tombe, puis « Bienvenue, *prénom* ! », les promesses de la plateforme et le
bouton « Entrer dans mon école ». « Passer », Échap ou le bouton la ferment ;
elle se ferme seule après quelques secondes.

- Le serveur (`auth.controller.js`, `ouvrirSession`) renvoie
  `premiere_connexion: true` quand la session qui vient d'être écrite est la
  seule de cet utilisateur.
- `connexion.html` range ce drapeau dans le `sessionStorage` de l'onglet ; il
  survit au détour éventuel par « changer le mot de passe ».
- `theme-signatures.js` le consomme une seule fois et note sur l'appareil que
  l'accueil a été vu.

## Vérification

`node test-signatures-browser.cjs` (Playwright, vrais scripts partagés, API
simulées) : déconnexion atteignable dans les 12 apparences à 1440×900,
1280×640 et 1024×600 puis dans le tiroir mobile, absence de débordement à
390 px, widget et scène de chaque apparence, garde-fou de secours, annonce au
changement d'apparence, accueil de première connexion joué une seule fois, et
rail Super Admin sur un écran de 520 px de haut (Ardoise, Fluide, Nuit).
`SIGNATURES_BROWSER` choisit un Chromium installé ; `SIGNATURES_SHOT` un
dossier de captures. Service worker : v93, fichiers précachés.

## Pro et Savane

Deux apparences classiques (le rail reste déplaçable : gauche, droite, haut,
bas, compact) avec leur fichier de couleurs et de finition :
`theme-pro.css` et `theme-savane.css`, importés par `theme.css`, précachés par
le service worker v94. Le serveur accepte les clés `pro` et `savane`
(`THEMES_AUTORISES`), ainsi que `yohali`, la clé que le navigateur envoie pour
Terranga et qui était jusqu'ici refusée.

## Choix des animations

**Mon profil → Apparence → « Animations et effets »** (et la section
« Navigation et animations » de l'Apparence du Super Admin). Cochée par
défaut. Décochée, plus rien ne bouge : scènes, entrées des cartes, effets au
clic, rideaux, avions, accueil de première connexion — chaque élément
s'affiche directement dans son état final. L'annonce de la devise reste, sans
rideau. Le réglage système « réduire les animations » est toujours respecté,
même case cochée.

- Choix propre à l'appareil (`localStorage.ardoise_animations = 'non'`),
  comme la disposition du menu ; suivi entre onglets.
- Le script d'amorçage de chaque page pose `data-animations="non"` avant le
  premier affichage : aucune animation ne démarre avant d'être coupée.
- `window.ArdoiseAnimations` (`theme.js`) : `actives()`, `calmes()`,
  `definir(oui)`, événement `ardoise:animations-change`.

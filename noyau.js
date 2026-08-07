/* ==========================================================================
   Ardoise — Espace Super Administrateur : noyau
   --------------------------------------------------------------------------
   Ce fichier est le socle commun des vues. Il fournit cinq choses et rien
   d'autre : l'accès à l'API, le routeur, les composants d'interface, les
   graphiques, et le formatage.

   ISOLEMENT — à ne pas défaire.
   L'en-tête de super-admin.html prévient que ce panneau est volontairement
   séparé du reste de l'application : clés de jeton distinctes
   (ardoise_admin_*), navigation propre, aucune dépendance à ui.js ni aux
   scripts de mise à jour groupée des pages applicatives. Cette séparation est
   délibérée — le panneau se connecte avec un compte qui voit toutes les
   écoles, il ne doit jamais partager de session avec l'espace d'une école.
   Le présent fichier respecte cette règle : il ne lit et n'écrit que les clés
   `ardoise_admin_*`, et n'appelle aucune fonction des pages applicatives.

   En revanche il réutilise theme.css et ui.css : ce sont des feuilles de
   style, elles ne portent aucune session, et s'en priver signifierait
   réinventer la charte visuelle d'Ardoise en divergeant d'elle à la première
   retouche.
   ========================================================================== */

(function () {
  'use strict';

  const SA = {};
  window.SA = SA;

  /* ======================================================================
     1. Configuration et session
     ====================================================================== */

  SA.API_BASE_URL = 'https://scolaire-saas-backend.onrender.com';

  const CLE_ACCES = 'ardoise_admin_access_token';
  const CLE_RAFRAICHISSEMENT = 'ardoise_admin_refresh_token';
  const CLE_PROFIL = 'ardoise_admin_profil';
  const CLE_PERSISTANT = 'ardoise_admin_persistant';
  const CLE_EXPIRATION = 'ardoise_admin_expire_le';

  const TOUTES_LES_CLES = [
    CLE_ACCES, CLE_RAFRAICHISSEMENT, CLE_PROFIL, CLE_PERSISTANT, CLE_EXPIRATION
  ];

  /* Durée de vie d'une session « Se souvenir de moi ». Elle doit rester
     inférieure ou égale à JWT_REFRESH_EXPIRES_DAYS côté serveur, sinon on
     garde localement une session que le serveur a déjà oubliée. */
  const MEMOIRE_JOURS = 30;

  /**
   * SESSION — comportement voulu, à ne pas défaire.
   * ---------------------------------------------------------------------
   * Par défaut la session vit dans `sessionStorage` : elle meurt à la
   * fermeture de l'onglet. Revenir sur l'adresse une heure plus tard
   * redemande donc l'email et le mot de passe, ce qui est le seul
   * comportement acceptable pour un compte qui voit toutes les écoles.
   *
   * `localStorage` — donc une session qui survit à la fermeture du
   * navigateur — n'est utilisé que si l'utilisateur a coché lui-même
   * « Se souvenir de moi sur cet appareil ». Ce choix est daté : passé
   * MEMOIRE_JOURS, la session est effacée localement même si le serveur
   * l'accepterait encore.
   */
  function depots() {
    const liste = [];
    try { liste.push(sessionStorage); } catch (e) { /* indisponible */ }
    try { liste.push(localStorage); } catch (e) { /* indisponible */ }
    return liste;
  }

  /** Le dépôt qui porte réellement la session en cours, ou null. */
  function depotActif() {
    const liste = depots();
    for (let i = 0; i < liste.length; i++) {
      try { if (liste[i].getItem(CLE_ACCES)) return liste[i]; } catch (e) { /* ignoré */ }
    }
    return null;
  }

  function memoireExpiree(depot) {
    try {
      const echeance = depot.getItem(CLE_EXPIRATION);
      return Boolean(echeance) && Date.now() > Number(echeance);
    } catch (e) { return false; }
  }

  SA.session = {
    jetons() {
      const depot = depotActif();
      if (!depot) return { acces: null, rafraichissement: null };

      // Session héritée de l'ancien comportement : elle vit dans localStorage
      // sans que personne n'ait coché « Se souvenir de moi », puisque la case
      // n'existait pas. On la refuse — c'est précisément la reconnexion
      // silencieuse qu'on veut supprimer. Une seule saisie du mot de passe
      // suffit à repartir sur le nouveau fonctionnement.
      let persistant = false;
      try { persistant = depot.getItem(CLE_PERSISTANT) === '1'; } catch (e) { /* ignoré */ }
      if (depot === localStorage && !persistant) {
        SA.session.effacer();
        return { acces: null, rafraichissement: null };
      }

      if (memoireExpiree(depot)) {
        SA.session.effacer();
        return { acces: null, rafraichissement: null };
      }
      try {
        return {
          acces: depot.getItem(CLE_ACCES),
          rafraichissement: depot.getItem(CLE_RAFRAICHISSEMENT)
        };
      } catch (e) { return { acces: null, rafraichissement: null }; }
    },

    /** @param {boolean} seSouvenir — coche « Se souvenir de moi ». */
    enregistrer(donnees, seSouvenir) {
      // On efface d'abord partout : sans ça, une ancienne session persistante
      // resterait dans localStorage et reprendrait la main au prochain retour,
      // alors que l'utilisateur vient de se connecter sans cocher la case.
      SA.session.effacer();
      try {
        const depot = seSouvenir ? localStorage : sessionStorage;
        depot.setItem(CLE_ACCES, donnees.access_token);
        depot.setItem(CLE_RAFRAICHISSEMENT, donnees.refresh_token);
        if (donnees.user) depot.setItem(CLE_PROFIL, JSON.stringify(donnees.user));
        if (seSouvenir) {
          depot.setItem(CLE_PERSISTANT, '1');
          depot.setItem(CLE_EXPIRATION, String(Date.now() + MEMOIRE_JOURS * 86400000));
        }
      } catch (e) { /* navigation privée : la session vit le temps de l'onglet */ }
    },

    /** Met à jour le seul access token, sans changer de dépôt. */
    majAcces(jeton) {
      const depot = depotActif();
      if (!depot) return;
      try { depot.setItem(CLE_ACCES, jeton); } catch (e) { /* ignoré */ }
    },

    profil() {
      const depot = depotActif();
      if (!depot) return null;
      try { return JSON.parse(depot.getItem(CLE_PROFIL) || 'null'); }
      catch (e) { return null; }
    },

    persistante() {
      const depot = depotActif();
      if (!depot) return false;
      try { return depot.getItem(CLE_PERSISTANT) === '1'; } catch (e) { return false; }
    },

    /** Efface dans les DEUX dépôts : une déconnexion ne laisse rien derrière. */
    effacer() {
      depots().forEach(function (depot) {
        TOUTES_LES_CLES.forEach(function (cle) {
          try { depot.removeItem(cle); } catch (e) { /* rien à nettoyer */ }
        });
      });
    },

    connecte() { return Boolean(SA.session.jetons().acces); }
  };

  /* ======================================================================
     2. Client API
     ====================================================================== */

  let rafraichissementEnCours = null;

  async function rafraichirJeton() {
    // Mutualisé : trois requêtes qui expirent en même temps ne doivent
    // déclencher qu'un seul rafraîchissement, sinon les deux dernières
    // présentent un refresh token déjà consommé et déconnectent l'utilisateur.
    if (rafraichissementEnCours) return rafraichissementEnCours;

    const { rafraichissement } = SA.session.jetons();
    if (!rafraichissement) return null;

    rafraichissementEnCours = (async () => {
      try {
        const reponse = await fetch(`${SA.API_BASE_URL}/auth/refresh`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rafraichissement })
        });
        if (!reponse.ok) return null;
        const donnees = await reponse.json();
        // Écrire dans le dépôt actif : si la session vit dans sessionStorage
        // (case « Se souvenir de moi » non cochée), écrire dans localStorage
        // la rendrait persistante à l'insu de l'utilisateur.
        SA.session.majAcces(donnees.access_token);
        return donnees.access_token;
      } catch (e) {
        return null;
      } finally {
        setTimeout(() => { rafraichissementEnCours = null; }, 0);
      }
    })();

    return rafraichissementEnCours;
  }

  /**
   * Appel API authentifié.
   * Lève une `ErreurApi` en cas d'échec : les vues attrapent et affichent,
   * plutôt que de tester un retour null à chaque appel.
   */
  class ErreurApi extends Error {
    constructor(message, statut, corps) {
      super(message);
      this.statut = statut;
      this.corps = corps;
    }
  }
  SA.ErreurApi = ErreurApi;

  SA.api = async function (chemin, options = {}) {
    const { acces } = SA.session.jetons();
    if (!acces) { SA.deconnecter({ message: 'Session expirée. Reconnectez-vous.' }); throw new ErreurApi('Session expirée.', 401); }

    const executer = (jeton) => {
      const entetes = Object.assign({}, options.headers || {}, { Authorization: `Bearer ${jeton}` });
      if (options.body && !entetes['Content-Type']) entetes['Content-Type'] = 'application/json';
      return fetch(`${SA.API_BASE_URL}${chemin}`, Object.assign({}, options, { headers: entetes }));
    };

    let reponse;
    try {
      reponse = await executer(acces);
    } catch (e) {
      throw new ErreurApi('Serveur injoignable. Vérifiez la connexion réseau.', 0);
    }

    if (reponse.status === 401) {
      const nouveau = await rafraichirJeton();
      if (!nouveau) { SA.deconnecter({ message: 'Session expirée. Reconnectez-vous.' }); throw new ErreurApi('Session expirée.', 401); }
      reponse = await executer(nouveau);
    }

    if (reponse.status === 401 || reponse.status === 403) {
      const corps = await reponse.json().catch(() => ({}));
      if (reponse.status === 401) SA.deconnecter({ message: 'Session expirée. Reconnectez-vous.' });
      throw new ErreurApi(corps.message || 'Accès refusé.', reponse.status, corps);
    }

    if (!reponse.ok) {
      const corps = await reponse.json().catch(() => ({}));
      throw new ErreurApi(corps.message || `Erreur ${reponse.status}.`, reponse.status, corps);
    }

    const type = reponse.headers.get('content-type') || '';
    return type.includes('application/json') ? reponse.json() : reponse.text();
  };

  /** Construit une URL avec paramètres, en omettant les valeurs vides. */
  SA.url = function (chemin, params = {}) {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([cle, valeur]) => {
      if (valeur === undefined || valeur === null || valeur === '') return;
      q.set(cle, valeur);
    });
    const chaine = q.toString();
    return chaine ? `${chemin}?${chaine}` : chemin;
  };

  /** Télécharge un fichier protégé par jeton (les liens <a> n'envoient pas d'en-tête). */
  SA.telecharger = async function (chemin, nomFichier) {
    const { acces } = SA.session.jetons();
    const reponse = await fetch(`${SA.API_BASE_URL}${chemin}`, {
      headers: { Authorization: `Bearer ${acces}` }
    });
    if (!reponse.ok) throw new ErreurApi('Téléchargement impossible.', reponse.status);

    const blob = await reponse.blob();
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(blob);
    lien.download = nomFichier;
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 4000);
  };

  /**
   * Vide les champs du formulaire de connexion.
   * ---------------------------------------------------------------------
   * Ce n'est pas de la coquetterie : après un `location.reload()`, les
   * navigateurs restaurent d'eux-mêmes les valeurs saisies dans les
   * formulaires — l'email et le mot de passe du super admin réapparaissaient
   * donc en clair sur l'écran de connexion juste après la déconnexion.
   * On les efface explicitement, et on le refait au `pageshow` (retour
   * arrière depuis le cache du navigateur) et après un tour de boucle,
   * car la restauration a lieu après le premier rendu.
   */
  SA.viderFormulaireConnexion = function () {
    const formulaire = document.getElementById('formulaire-connexion');
    if (!formulaire) return;
    try { formulaire.reset(); } catch (e) { /* ignoré */ }
    const email = document.getElementById('champ-email');
    const motDePasse = document.getElementById('champ-mot-de-passe');
    const souvenir = document.getElementById('case-souvenir');
    if (email) email.value = '';
    if (motDePasse) motDePasse.value = '';
    if (souvenir) souvenir.checked = false;
  };

  /**
   * Déconnexion.
   * @param {{message?: string, recharger?: boolean}} options
   *
   * Trois gestes, dans cet ordre :
   *   1. révoquer le refresh token côté serveur (`/auth/logout` supprime la
   *      ligne `sessions`). Sans lui, effacer le navigateur ne servait à rien :
   *      le jeton restait valable 30 jours en base, donc réutilisable ;
   *   2. effacer les deux dépôts locaux ;
   *   3. remettre l'écran de connexion à zéro, champs compris.
   */
  SA.deconnecter = function (options) {
    const opts = options || {};
    const { rafraichissement } = SA.session.jetons();

    SA.session.effacer();

    if (rafraichissement) {
      // `keepalive` : la requête survit au rechargement de la page.
      try {
        fetch(`${SA.API_BASE_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: rafraichissement }),
          keepalive: true
        }).catch(function () { /* hors ligne : la session locale est déjà effacée */ });
      } catch (e) { /* ignoré */ }
    }

    if (opts.recharger) {
      // `replace` et non `reload` : on repart d'une URL propre (sans le hash
      // de la dernière vue) et sans entrée d'historique vers le panneau.
      location.replace(location.pathname);
      return;
    }

    const application = document.getElementById('application');
    const ecran = document.getElementById('ecran-connexion');
    if (application) {
      application.style.display = 'none';
      // On vide la zone de contenu : les données des écoles ne doivent pas
      // rester lisibles dans le DOM derrière l'écran de connexion.
      const contenu = document.getElementById('sa-contenu');
      if (contenu) contenu.innerHTML = '';
    }
    if (ecran) ecran.style.display = 'flex';
    SA.viderFormulaireConnexion();

    if (opts.message) {
      const zone = document.getElementById('erreur-connexion');
      if (zone) { zone.textContent = opts.message; zone.classList.add('visible'); }
    }
  };

  /* ======================================================================
     3. Formatage
     ====================================================================== */

  const FR = 'fr-FR';

  SA.fmt = {
    nombre(v) {
      if (v === null || v === undefined || v === '') return '—';
      const n = Number(v);
      return Number.isFinite(n) ? n.toLocaleString(FR) : String(v);
    },
    decimal(v, decimales = 1) {
      if (v === null || v === undefined || v === '') return '—';
      const n = Number(v);
      return Number.isFinite(n)
        ? n.toLocaleString(FR, { minimumFractionDigits: decimales, maximumFractionDigits: decimales })
        : String(v);
    },
    pourcent(v, decimales = 1) {
      if (v === null || v === undefined || v === '') return '—';
      return `${SA.fmt.decimal(v, decimales)} %`;
    },
    montant(v, devise) {
      if (v === null || v === undefined || v === '') return '—';
      return `${Number(v).toLocaleString(FR, { maximumFractionDigits: 2 })} ${devise || ''}`.trim();
    },
    date(v) {
      if (!v) return '—';
      const d = new Date(v);
      return isNaN(d) ? '—' : d.toLocaleDateString(FR, { day: '2-digit', month: 'short', year: 'numeric' });
    },
    dateHeure(v) {
      if (!v) return '—';
      const d = new Date(v);
      return isNaN(d) ? '—' : d.toLocaleString(FR, {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
    },
    /** « il y a 3 heures » — plus parlant qu'une date pour de la supervision. */
    relatif(v) {
      if (!v) return '—';
      const d = new Date(v);
      if (isNaN(d)) return '—';
      const secondes = Math.round((Date.now() - d.getTime()) / 1000);
      if (secondes < 60) return "à l'instant";
      const paliers = [
        [60, 'minute'], [3600, 'heure'], [86400, 'jour'], [2592000, 'mois'], [31536000, 'an']
      ];
      let valeur = secondes, unite = 'seconde';
      for (let i = paliers.length - 1; i >= 0; i--) {
        if (secondes >= paliers[i][0]) {
          valeur = Math.floor(secondes / paliers[i][0]);
          unite = paliers[i][1];
          break;
        }
      }
      const pluriel = valeur > 1 ? (unite === 'mois' ? 'mois' : unite + 's') : unite;
      return `il y a ${valeur} ${pluriel}`;
    },
    octets(v) {
      if (v === null || v === undefined) return '—';
      const n = Number(v);
      if (!Number.isFinite(n)) return '—';
      const unites = ['o', 'Ko', 'Mo', 'Go', 'To'];
      let i = 0, taille = n;
      while (taille >= 1024 && i < unites.length - 1) { taille /= 1024; i++; }
      return `${taille.toFixed(i === 0 ? 0 : 1)} ${unites[i]}`;
    },
    duree(ms) {
      if (ms === null || ms === undefined) return '—';
      const n = Number(ms);
      if (!Number.isFinite(n)) return '—';
      if (n < 1000) return `${Math.round(n)} ms`;
      if (n < 60000) return `${(n / 1000).toFixed(1)} s`;
      if (n < 3600000) return `${Math.round(n / 60000)} min`;
      return `${(n / 3600000).toFixed(1)} h`;
    },
    dureeSecondes(s) {
      if (s === null || s === undefined) return '—';
      const n = Number(s);
      const jours = Math.floor(n / 86400);
      const heures = Math.floor((n % 86400) / 3600);
      const minutes = Math.floor((n % 3600) / 60);
      if (jours) return `${jours} j ${heures} h`;
      if (heures) return `${heures} h ${minutes} min`;
      return `${minutes} min`;
    },
    role(r) {
      const libelles = {
        directeur: 'Directeur', prefet: 'Préfet', secretaire: 'Secrétaire',
        professeur: 'Professeur', titulaire: 'Titulaire', comptable: 'Comptable',
        parent: 'Parent', super_admin: 'Super Admin',
        charge_presences: 'Chargé des présences', directeur_discipline: 'Directeur de discipline'
      };
      return libelles[r] || r;
    }
  };

  /** Échappement HTML. Utilisé partout où une donnée serveur entre dans le DOM. */
  SA.esc = function (v) {
    if (v === null || v === undefined) return '';
    return String(v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  };

  /* ======================================================================
     4. Composants d'interface
     ====================================================================== */

  SA.ui = {};

  /** Carte d'indicateur. */
  SA.ui.carteStat = function ({ valeur, etiquette, detail, ton, icone }) {
    return `
      <div class="sa-carte-stat${ton ? ' ton-' + ton : ''}">
        ${icone ? `<div class="sa-carte-icone">${icone}</div>` : ''}
        <div class="sa-carte-valeur">${valeur === null || valeur === undefined ? '—' : valeur}</div>
        <div class="sa-carte-etiquette">${SA.esc(etiquette)}</div>
        ${detail ? `<div class="sa-carte-detail">${detail}</div>` : ''}
      </div>`;
  };

  SA.ui.badge = function (texte, ton) {
    return `<span class="sa-badge ton-${ton || 'neutre'}">${SA.esc(texte)}</span>`;
  };

  /** Traduit un statut métier en ton visuel. Table unique : elle évite que
   *  « actif » soit vert ici et gris ailleurs. */
  SA.ui.tonStatut = function (statut) {
    const tons = {
      actif: 'succes', reussie: 'succes', resolu: 'succes', envoye: 'succes',
      envoyee: 'succes', succes: 'succes', confirme: 'succes', operationnel: 'succes',
      en_cours: 'info', ouvert: 'info', normale: 'info', info: 'info',
      en_attente: 'attention', attente_client: 'attention', avertissement: 'attention',
      moyenne: 'attention', haute: 'attention', degrade: 'attention', expire: 'attention',
      suspendu: 'danger', echoue: 'danger', echouee: 'danger', critique: 'danger',
      urgente: 'danger', bloque: 'danger', inactif: 'danger',
      basse: 'neutre', ferme: 'neutre', ignore: 'neutre', brouillon: 'neutre'
    };
    return tons[String(statut || '').toLowerCase()] || 'neutre';
  };

  SA.ui.badgeStatut = function (statut) {
    if (!statut) return '<span class="sa-muet">—</span>';
    return SA.ui.badge(String(statut).replace(/_/g, ' '), SA.ui.tonStatut(statut));
  };

  /** Squelette de chargement. Une page vide donne l'impression d'un bug. */
  SA.ui.squelette = function (nbLignes = 5, hauteur = 42) {
    let html = '<div class="sa-squelettes">';
    for (let i = 0; i < nbLignes; i++) {
      html += `<div class="sa-squelette" style="height:${hauteur}px"></div>`;
    }
    return html + '</div>';
  };

  SA.ui.squeletteCartes = function (nb = 4) {
    let html = '<div class="sa-grille-stats">';
    for (let i = 0; i < nb; i++) html += '<div class="sa-squelette" style="height:96px"></div>';
    return html + '</div>';
  };

  SA.ui.etatVide = function (titre, detail) {
    return `<div class="sa-etat-vide">
      <div class="sa-etat-vide-titre">${SA.esc(titre)}</div>
      ${detail ? `<div class="sa-etat-vide-detail">${SA.esc(detail)}</div>` : ''}
    </div>`;
  };

  SA.ui.etatErreur = function (message, action) {
    return `<div class="sa-etat-erreur">
      <div class="sa-etat-vide-titre">Impossible d'afficher cette section</div>
      <div class="sa-etat-vide-detail">${SA.esc(message)}</div>
      ${action ? `<button class="sa-bouton sa-bouton-secondaire" data-action="${SA.esc(action)}" style="margin-top:14px">Réessayer</button>` : ''}
    </div>`;
  };

  /**
   * Tableau générique.
   * `colonnes` : [{ cle, titre, rendu?, classe?, triable? }]
   * `rendu(ligne)` renvoie du HTML déjà échappé — c'est la responsabilité de
   * l'appelant, faute de quoi on ne pourrait jamais afficher de badge.
   */
  SA.ui.tableau = function ({ colonnes, lignes, vide, cliquable, tri }) {
    if (!lignes || !lignes.length) {
      return `<div class="sa-conteneur-tableau">${SA.ui.etatVide(vide || 'Aucun résultat', 'Ajustez les filtres ou la recherche.')}</div>`;
    }

    const entetes = colonnes.map((c) => {
      if (!c.triable) return `<th class="${c.classe || ''}">${SA.esc(c.titre)}</th>`;
      const actif = tri && tri.cle === c.cle;
      const sens = actif && tri.sens === 'asc' ? 'asc' : 'desc';
      const fleche = actif ? (sens === 'asc' ? '↑' : '↓') : '';
      return `<th class="${c.classe || ''} sa-triable" data-tri="${SA.esc(c.cle)}"
                  data-sens="${actif && sens === 'desc' ? 'asc' : 'desc'}">
                ${SA.esc(c.titre)} <span class="sa-fleche-tri">${fleche}</span>
              </th>`;
    }).join('');

    const corps = lignes.map((ligne, index) => {
      const cellules = colonnes.map((c) => {
        const contenu = c.rendu ? c.rendu(ligne, index) : SA.esc(ligne[c.cle]);
        return `<td class="${c.classe || ''}">${contenu === undefined || contenu === null || contenu === '' ? '<span class="sa-muet">—</span>' : contenu}</td>`;
      }).join('');
      const id = ligne.id ? ` data-id="${SA.esc(ligne.id)}"` : '';
      return `<tr class="${cliquable ? 'sa-ligne-cliquable' : ''}"${id} data-index="${index}">${cellules}</tr>`;
    }).join('');

    return `<div class="sa-conteneur-tableau">
      <table class="sa-tableau">
        <thead><tr>${entetes}</tr></thead>
        <tbody>${corps}</tbody>
      </table>
    </div>`;
  };

  /** Pagination. */
  SA.ui.pagination = function (info) {
    if (!info || info.pages <= 1) {
      return info && info.total
        ? `<div class="sa-pagination"><span class="sa-muet">${SA.fmt.nombre(info.total)} résultat(s)</span></div>`
        : '';
    }
    const boutons = [];
    boutons.push(`<button class="sa-bouton-page" data-page="${info.page - 1}" ${info.page <= 1 ? 'disabled' : ''}>‹</button>`);

    const pages = new Set([1, info.pages, info.page, info.page - 1, info.page + 1]);
    const liste = [...pages].filter((p) => p >= 1 && p <= info.pages).sort((a, b) => a - b);

    let precedente = 0;
    for (const p of liste) {
      if (p - precedente > 1) boutons.push('<span class="sa-ellipse">…</span>');
      boutons.push(`<button class="sa-bouton-page${p === info.page ? ' actif' : ''}" data-page="${p}">${p}</button>`);
      precedente = p;
    }

    boutons.push(`<button class="sa-bouton-page" data-page="${info.page + 1}" ${info.page >= info.pages ? 'disabled' : ''}>›</button>`);

    return `<div class="sa-pagination">
      <span class="sa-muet">${SA.fmt.nombre(info.total)} résultat(s) · page ${info.page} / ${info.pages}</span>
      <div class="sa-pages">${boutons.join('')}</div>
    </div>`;
  };

  /** Message éphémère. */
  let compteurToast = 0;
  SA.toast = function (message, type = 'info', duree = 5000) {
    let zone = document.getElementById('sa-toasts');
    if (!zone) {
      zone = document.createElement('div');
      zone.id = 'sa-toasts';
      document.body.appendChild(zone);
    }
    const id = `toast-${++compteurToast}`;
    const element = document.createElement('div');
    element.className = `sa-toast ton-${type}`;
    element.id = id;
    element.innerHTML = `<span>${SA.esc(message)}</span><button aria-label="Fermer">×</button>`;
    element.querySelector('button').addEventListener('click', () => element.remove());
    zone.appendChild(element);
    setTimeout(() => { const e = document.getElementById(id); if (e) e.remove(); }, duree);
  };

  /** Modale. Renvoie une fonction de fermeture. */
  SA.modale = function ({ titre, sousTitre, contenu, actions, large }) {
    const voile = document.createElement('div');
    voile.className = 'sa-voile visible';
    voile.innerHTML = `
      <div class="sa-modale${large ? ' large' : ''}" role="dialog" aria-modal="true">
        <div class="sa-modale-entete">
          <div>
            <h2>${SA.esc(titre)}</h2>
            ${sousTitre ? `<p class="sa-modale-sous-titre">${SA.esc(sousTitre)}</p>` : ''}
          </div>
          <button class="sa-fermer" aria-label="Fermer">×</button>
        </div>
        <div class="sa-modale-corps">${contenu || ''}</div>
        ${actions ? `<div class="sa-modale-actions">${actions}</div>` : ''}
      </div>`;

    const fermer = () => { voile.remove(); document.removeEventListener('keydown', surEchap); };
    const surEchap = (e) => { if (e.key === 'Escape') fermer(); };

    voile.querySelector('.sa-fermer').addEventListener('click', fermer);
    voile.addEventListener('click', (e) => { if (e.target === voile) fermer(); });
    document.addEventListener('keydown', surEchap);

    document.body.appendChild(voile);
    voile.fermer = fermer;
    return voile;
  };

  /** Confirmation. Renvoie une promesse booléenne. */
  SA.confirmer = function ({ titre, message, libelleValider, danger }) {
    return new Promise((resoudre) => {
      const modale = SA.modale({
        titre: titre || 'Confirmer',
        contenu: `<p class="sa-texte">${SA.esc(message)}</p>`,
        actions: `
          <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
          <button class="sa-bouton ${danger ? 'sa-bouton-danger' : 'sa-bouton-principal'}" data-role="valider">
            ${SA.esc(libelleValider || 'Confirmer')}
          </button>`
      });
      modale.querySelector('[data-role="annuler"]').addEventListener('click', () => { modale.fermer(); resoudre(false); });
      modale.querySelector('[data-role="valider"]').addEventListener('click', () => { modale.fermer(); resoudre(true); });
    });
  };

  /** Anti-rebond : indispensable pour la recherche instantanée. */
  SA.antiRebond = function (fn, delai = 280) {
    let minuteur;
    return function (...args) {
      clearTimeout(minuteur);
      minuteur = setTimeout(() => fn.apply(this, args), delai);
    };
  };

  /* ======================================================================
     5. Graphiques (SVG, sans dépendance)
     ====================================================================== */

  SA.graphe = {};

  function bornes(valeurs) {
    const max = Math.max(...valeurs, 0);
    const min = Math.min(...valeurs, 0);
    return { max: max === min ? max + 1 : max, min };
  }

  /**
   * Courbe. `series` : [{ nom, points: [{x, y}], couleur }]
   * Tracée à la main plutôt qu'avec une bibliothèque : quatre courbes et deux
   * histogrammes ne justifient pas 300 Ko de dépendance sur une plateforme
   * dont les utilisateurs sont souvent en connexion mobile.
   */
  SA.graphe.courbe = function (series, options = {}) {
    const L = options.largeur || 720;
    const H = options.hauteur || 220;
    const marge = { haut: 14, droite: 14, bas: 26, gauche: 46 };
    const l = L - marge.gauche - marge.droite;
    const h = H - marge.haut - marge.bas;

    const toutes = series.flatMap((s) => s.points.map((p) => p.y));
    if (!toutes.length) return SA.ui.etatVide('Aucune donnée sur la période');
    const { max } = bornes(toutes);

    const nbPoints = Math.max(...series.map((s) => s.points.length));
    const px = (i) => marge.gauche + (nbPoints > 1 ? (i / (nbPoints - 1)) * l : l / 2);
    const py = (v) => marge.haut + h - (max ? (v / max) * h : 0);

    const grille = [0, 0.25, 0.5, 0.75, 1].map((f) => {
      const y = marge.haut + h - f * h;
      return `<line x1="${marge.gauche}" y1="${y}" x2="${L - marge.droite}" y2="${y}"
                    class="sa-grille" />
              <text x="${marge.gauche - 8}" y="${y + 4}" class="sa-axe" text-anchor="end">
                ${SA.fmt.nombre(Math.round(max * f))}
              </text>`;
    }).join('');

    const traces = series.map((s, indexSerie) => {
      const couleur = s.couleur || ['var(--ocre)', 'var(--encre)', 'var(--vert-ok)', 'var(--rouge)'][indexSerie % 4];
      const chemin = s.points.map((p, i) => `${i ? 'L' : 'M'}${px(i).toFixed(1)},${py(p.y).toFixed(1)}`).join(' ');
      const aire = options.aire !== false
        ? `<path d="${chemin} L${px(s.points.length - 1).toFixed(1)},${marge.haut + h} L${px(0).toFixed(1)},${marge.haut + h} Z"
                 fill="${couleur}" opacity="0.08" />`
        : '';
      const points = s.points.length <= 40
        ? s.points.map((p, i) => `<circle cx="${px(i).toFixed(1)}" cy="${py(p.y).toFixed(1)}" r="2.5"
              fill="${couleur}"><title>${SA.esc(p.x)} : ${SA.fmt.nombre(p.y)}</title></circle>`).join('')
        : '';
      return `${aire}<path d="${chemin}" fill="none" stroke="${couleur}" stroke-width="2"
                    stroke-linejoin="round" stroke-linecap="round" />${points}`;
    }).join('');

    const premiere = series[0].points;
    const etiquettes = premiere.length
      ? [0, Math.floor(premiere.length / 2), premiere.length - 1]
          .filter((i, idx, arr) => arr.indexOf(i) === idx && premiere[i])
          .map((i) => `<text x="${px(i).toFixed(1)}" y="${H - 6}" class="sa-axe"
                             text-anchor="${i === 0 ? 'start' : i === premiere.length - 1 ? 'end' : 'middle'}">
                         ${SA.esc(premiere[i].x)}</text>`).join('')
      : '';

    const legende = series.length > 1
      ? `<div class="sa-legende">${series.map((s, i) => {
          const c = s.couleur || ['var(--ocre)', 'var(--encre)', 'var(--vert-ok)', 'var(--rouge)'][i % 4];
          return `<span><i style="background:${c}"></i>${SA.esc(s.nom)}</span>`;
        }).join('')}</div>`
      : '';

    return `<div class="sa-graphe">
      <svg viewBox="0 0 ${L} ${H}" preserveAspectRatio="none" role="img"
           aria-label="${SA.esc(options.titre || 'Graphique')}">
        ${grille}${traces}${etiquettes}
      </svg>${legende}</div>`;
  };

  /** Histogramme horizontal — lisible même avec des libellés longs. */
  SA.graphe.barres = function (donnees, options = {}) {
    if (!donnees || !donnees.length) return SA.ui.etatVide('Aucune donnée');
    const max = Math.max(...donnees.map((d) => Number(d.valeur) || 0), 1);
    const couleur = options.couleur || 'var(--ocre)';

    return `<div class="sa-barres">${donnees.map((d) => {
      const valeur = Number(d.valeur) || 0;
      const largeur = Math.max(1, (valeur / max) * 100);
      return `<div class="sa-barre-ligne">
        <div class="sa-barre-libelle" title="${SA.esc(d.libelle)}">${SA.esc(d.libelle)}</div>
        <div class="sa-barre-piste">
          <div class="sa-barre-remplissage" style="width:${largeur}%; background:${couleur}"></div>
        </div>
        <div class="sa-barre-valeur">${options.format ? options.format(valeur) : SA.fmt.nombre(valeur)}</div>
      </div>`;
    }).join('')}</div>`;
  };

  /** Anneau de progression — un seul indicateur, lu d'un coup d'œil. */
  SA.graphe.anneau = function ({ valeur, max, libelle, ton, unite }) {
    const taux = max ? Math.min(1, Math.max(0, valeur / max)) : 0;
    const rayon = 42;
    const circonference = 2 * Math.PI * rayon;
    const couleurs = {
      succes: 'var(--vert-ok)', attention: 'var(--ocre)',
      danger: 'var(--rouge)', info: 'var(--encre)'
    };
    const couleur = couleurs[ton] || 'var(--ocre)';

    return `<div class="sa-anneau">
      <svg viewBox="0 0 110 110">
        <circle cx="55" cy="55" r="${rayon}" fill="none" stroke="var(--bordure)" stroke-width="9" />
        <circle cx="55" cy="55" r="${rayon}" fill="none" stroke="${couleur}" stroke-width="9"
                stroke-linecap="round" stroke-dasharray="${circonference}"
                stroke-dashoffset="${circonference * (1 - taux)}"
                transform="rotate(-90 55 55)" />
        <text x="55" y="52" text-anchor="middle" class="sa-anneau-valeur">
          ${unite === '%' ? Math.round(taux * 100) + ' %' : SA.fmt.nombre(valeur)}
        </text>
        <text x="55" y="70" text-anchor="middle" class="sa-anneau-libelle">${SA.esc(libelle || '')}</text>
      </svg>
    </div>`;
  };

  /** Bandes empilées — répartition sur 100 %. */
  SA.graphe.repartition = function (donnees) {
    if (!donnees || !donnees.length) return SA.ui.etatVide('Aucune donnée');
    const total = donnees.reduce((s, d) => s + (Number(d.valeur) || 0), 0) || 1;
    const palette = ['var(--ocre)', 'var(--encre)', 'var(--vert-ok)', 'var(--rouge)', 'var(--ocre-clair)'];

    const segments = donnees.map((d, i) => {
      const part = ((Number(d.valeur) || 0) / total) * 100;
      return `<div class="sa-segment" style="width:${part}%; background:${d.couleur || palette[i % palette.length]}"
                   title="${SA.esc(d.libelle)} : ${SA.fmt.nombre(d.valeur)}"></div>`;
    }).join('');

    const legende = donnees.map((d, i) => `
      <span><i style="background:${d.couleur || palette[i % palette.length]}"></i>
      ${SA.esc(d.libelle)} <strong>${SA.fmt.nombre(d.valeur)}</strong></span>`).join('');

    return `<div class="sa-repartition">
      <div class="sa-bande">${segments}</div>
      <div class="sa-legende">${legende}</div>
    </div>`;
  };

  /* ======================================================================
     6. Routeur
     ====================================================================== */

  const vues = new Map();
  SA.vues = vues;

  /**
   * Enregistre une vue.
   * @param {string} cle    - fragment d'URL (ex. 'ecoles/abonnements')
   * @param {object} vue    - { titre, sousTitre, actions?, rendu(conteneur, params) }
   */
  SA.enregistrerVue = function (cle, vue) {
    vues.set(cle, vue);
  };

  SA.routeCourante = null;

  function analyserHash() {
    const brut = (location.hash || '#/tableau-de-bord').replace(/^#\/?/, '');
    const [chemin, requete] = brut.split('?');
    const params = {};
    if (requete) new URLSearchParams(requete).forEach((v, k) => { params[k] = v; });
    return { chemin: chemin || 'tableau-de-bord', params };
  }

  SA.naviguer = function (chemin, params) {
    const requete = params && Object.keys(params).length
      ? '?' + new URLSearchParams(params).toString() : '';
    location.hash = `#/${chemin}${requete}`;
  };

  /** Met à jour l'URL sans redéclencher le rendu (filtres, pagination). */
  SA.majParams = function (params) {
    const { chemin } = analyserHash();
    const propres = {};
    Object.entries(params).forEach(([k, v]) => { if (v !== '' && v !== null && v !== undefined) propres[k] = v; });
    const requete = Object.keys(propres).length ? '?' + new URLSearchParams(propres).toString() : '';
    history.replaceState(null, '', `#/${chemin}${requete}`);
  };

  async function rendre() {
    const { chemin, params } = analyserHash();

    // Résolution : on cherche la vue exacte, puis on remonte les segments.
    // '#/explorer/ecole/<id>' tombe ainsi sur la vue 'explorer/ecole'.
    let cle = chemin;
    let reste = [];
    while (cle && !vues.has(cle)) {
      const morceaux = cle.split('/');
      reste.unshift(morceaux.pop());
      cle = morceaux.join('/');
    }

    const vue = vues.get(cle);
    const conteneur = document.getElementById('sa-contenu');
    const entete = document.getElementById('sa-entete');

    if (!vue) {
      entete.innerHTML = '<h1>Page introuvable</h1>';
      conteneur.innerHTML = SA.ui.etatVide('Cette section n\'existe pas', 'Utilisez le menu de gauche.');
      return;
    }

    SA.routeCourante = { cle, chemin, params, segments: reste };
    marquerMenuActif(chemin);

    entete.innerHTML = `
      <div>
        <h1>${SA.esc(typeof vue.titre === 'function' ? vue.titre(reste, params) : vue.titre)}</h1>
        ${vue.sousTitre ? `<p class="sa-sous-titre">${SA.esc(vue.sousTitre)}</p>` : ''}
      </div>
      <div class="sa-entete-actions" id="sa-entete-actions"></div>`;

    conteneur.innerHTML = SA.ui.squelette(6);

    try {
      await vue.rendu(conteneur, params, reste);
    } catch (err) {
      console.error('Erreur de rendu de la vue', cle, err);
      conteneur.innerHTML = SA.ui.etatErreur(
        err instanceof ErreurApi ? err.message : "Une erreur inattendue s'est produite.",
        'recharger'
      );
      const bouton = conteneur.querySelector('[data-action="recharger"]');
      if (bouton) bouton.addEventListener('click', rendre);

      // Le panneau se signale à lui-même : un plantage d'interface arrive au
      // centre de bugs sans que personne n'ait à le recopier à la main.
      signalerErreur(err, `#/${chemin}`);
    }

    // Sur mobile, la navigation se referme après un choix — sinon elle masque
    // la page qu'on vient justement de demander.
    document.body.classList.remove('sa-nav-ouverte');
    conteneur.scrollIntoView({ block: 'start', behavior: 'auto' });
  }

  SA.rafraichirVue = rendre;

  function marquerMenuActif(chemin) {
    document.querySelectorAll('#sa-navigation a[data-route]').forEach((lien) => {
      const route = lien.getAttribute('data-route');
      const actif = chemin === route || chemin.startsWith(route + '/');
      lien.classList.toggle('actif', actif);
      if (actif) {
        const groupe = lien.closest('.sa-groupe');
        if (groupe) groupe.classList.add('ouvert');
      }
    });
  }

  /* ======================================================================
     7. Remontée automatique des erreurs
     ====================================================================== */

  let derniereEmpreinte = null;

  function signalerErreur(erreur, page) {
    // Une erreur réseau ne se signale pas par le réseau : la tentative
    // échouerait, déclencherait une nouvelle erreur, et ainsi de suite.
    if (erreur instanceof ErreurApi && (erreur.statut === 0 || erreur.statut === 401)) return;

    const empreinte = `${erreur && erreur.message}|${page}`;
    if (empreinte === derniereEmpreinte) return;   // anti-boucle
    derniereEmpreinte = empreinte;
    setTimeout(() => { derniereEmpreinte = null; }, 30000);

    if (!SA.session.connecte()) return;

    SA.api('/super-admin/bugs/signaler', {
      method: 'POST',
      body: JSON.stringify({
        message: String((erreur && erreur.message) || erreur).slice(0, 1000),
        stack: erreur && erreur.stack ? String(erreur.stack).slice(0, 5000) : null,
        page: page || location.hash,
        origine: 'frontend',
        navigateur: navigator.userAgent,
        systeme: navigator.platform,
        gravite: 'moyenne'
      })
    }).catch(() => { /* le signalement est un service, pas une obligation */ });
  }
  SA.signalerErreur = signalerErreur;

  window.addEventListener('error', (e) => {
    if (e.error) signalerErreur(e.error, location.hash);
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (e.reason && !(e.reason instanceof ErreurApi && e.reason.statut === 401)) {
      signalerErreur(e.reason, location.hash);
    }
  });

  /* ======================================================================
     8. Référentiels partagés
     ====================================================================== */

  SA.referentiels = null;

  SA.chargerReferentiels = async function (forcer) {
    if (SA.referentiels && !forcer) return SA.referentiels;
    SA.referentiels = await SA.api('/super-admin/referentiels');
    return SA.referentiels;
  };

  /** <select> des écoles, prêt à poser dans une barre de filtres. */
  SA.ui.selecteurEcoles = function (valeurCourante, options = {}) {
    const ecoles = (SA.referentiels && SA.referentiels.ecoles) || [];
    const choix = ecoles.map((e) =>
      `<option value="${SA.esc(e.id)}" ${valeurCourante === e.id ? 'selected' : ''}>${SA.esc(e.nom)}</option>`
    ).join('');
    return `<select class="sa-champ" data-filtre="${options.nom || 'ecole_id'}">
      <option value="">${SA.esc(options.libelleVide || 'Toutes les écoles')}</option>${choix}
    </select>`;
  };

  /* ======================================================================
     9. Barre de filtres réutilisable
     ====================================================================== */

  /**
   * Construit une barre de filtres et branche ses écouteurs.
   * `champs` : [{ type: 'recherche'|'select'|'date', nom, libelle, options?, valeur? }]
   * `surChangement(valeurs)` est rappelé après anti-rebond pour la recherche,
   * immédiatement pour les autres champs.
   */
  SA.ui.barreFiltres = function (conteneur, champs, surChangement) {
    const html = champs.map((c) => {
      if (c.type === 'recherche') {
        return `<input type="search" class="sa-champ sa-champ-recherche" data-filtre="${SA.esc(c.nom)}"
                       placeholder="${SA.esc(c.libelle || 'Rechercher…')}" value="${SA.esc(c.valeur || '')}" />`;
      }
      if (c.type === 'date') {
        return `<label class="sa-champ-date"><span>${SA.esc(c.libelle)}</span>
                <input type="date" class="sa-champ" data-filtre="${SA.esc(c.nom)}" value="${SA.esc(c.valeur || '')}" /></label>`;
      }
      if (c.type === 'ecoles') {
        return SA.ui.selecteurEcoles(c.valeur, { nom: c.nom, libelleVide: c.libelle });
      }
      const options = (c.options || []).map((o) => {
        const valeur = typeof o === 'string' ? o : o.valeur;
        const libelle = typeof o === 'string' ? o : o.libelle;
        return `<option value="${SA.esc(valeur)}" ${String(c.valeur) === String(valeur) ? 'selected' : ''}>${SA.esc(libelle)}</option>`;
      }).join('');
      return `<select class="sa-champ" data-filtre="${SA.esc(c.nom)}">
                <option value="">${SA.esc(c.libelle)}</option>${options}
              </select>`;
    }).join('');

    const barre = document.createElement('div');
    barre.className = 'sa-barre-filtres';
    barre.innerHTML = html;
    conteneur.appendChild(barre);

    const lire = () => {
      const valeurs = {};
      barre.querySelectorAll('[data-filtre]').forEach((champ) => {
        valeurs[champ.getAttribute('data-filtre')] = champ.value;
      });
      return valeurs;
    };

    const declencherDifféré = SA.antiRebond(() => surChangement(lire()), 320);

    barre.querySelectorAll('input[type="search"]').forEach((champ) => {
      champ.addEventListener('input', declencherDifféré);
    });
    barre.querySelectorAll('select, input[type="date"]').forEach((champ) => {
      champ.addEventListener('change', () => surChangement(lire()));
    });

    return { element: barre, lire };
  };

  /* ======================================================================
     10. Démarrage
     ====================================================================== */

  SA.demarrer = async function () {
    document.getElementById('ecran-connexion').style.display = 'none';
    document.getElementById('application').style.display = 'flex';

    const profil = SA.session.profil();
    const zone = document.getElementById('sa-identite');
    if (zone && profil) {
      zone.textContent = profil.email || 'Super Administrateur';
    }

    try {
      await SA.chargerReferentiels();
    } catch (e) {
      SA.toast('Référentiels indisponibles : certains filtres seront vides.', 'attention');
    }

    window.addEventListener('hashchange', rendre);
    // Poser le hash déclenche `hashchange`, donc le rendu. S'il est déjà posé
    // (rechargement sur une section précise), il faut appeler soi-même.
    if (!location.hash) location.hash = '#/tableau-de-bord';
    else rendre();
  };
})();

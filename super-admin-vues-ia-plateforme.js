/* ==========================================================================
   ARDOISE — IA & MODÈLES
   --------------------------------------------------------------------------
   Fournisseurs, registre des modèles, routage par fonction, profils, coûts,
   politiques d'autorisation.

   CE QUE CES ÉCRANS DISENT, ET CE QU'ILS REFUSENT DE FAIRE CROIRE
   ---------------------------------------------------------------
   · Une CLÉ n'est jamais affichée. Le serveur n'en renvoie que l'aperçu
     masqué ; l'interface n'a donc rien à masquer elle-même, et rien à
     divulguer par accident.
   · Un PRIX porte toujours la date de sa dernière vérification. Un tarif
     jamais vérifié est écrit comme tel, en toutes lettres, parce qu'un coût
     calculé dessus n'est pas une facture.
   · Un COÛT distingue ce qui est mesuré de ce qui est estimé. Les deux
     nombres sont affichés séparément : les additionner sans le dire
     fabriquerait un chiffre faux qui aurait l'air d'un fait.
   · Un ÉTAT de fournisseur est celui du monde réel, pas celui qu'on espère.
     « Actif » avec une clé absente s'affiche « non configuré ».
   ========================================================================== */

(function () {
  'use strict';

  const { esc, ui } = SA;
  const BASE = '/super-admin/ia';

  /* ======================================================================
     OUTILS COMMUNS
     ====================================================================== */

  /**
   * Rejoue une action après confirmation du mot de passe.
   *
   * Le SERVEUR décide : il répond 403 avec `REAUTHENTIFICATION_REQUISE`, et
   * l'interface se contente de présenter la boîte au bon moment. Elle ne
   * devine pas quelles actions sont sensibles, et ne peut donc pas se tromper
   * dans le sens permissif.
   */
  async function avecReauthentification(action) {
    try {
      return await action();
    } catch (err) {
      if (!err || err.code !== 'REAUTHENTIFICATION_REQUISE') throw err;
      const motDePasse = await demanderMotDePasse();
      if (!motDePasse) return null;
      await SA.api('/super-admin/control-center/reauthentifier', {
        method: 'POST', body: JSON.stringify({ mot_de_passe: motDePasse })
      });
      return action();
    }
  }

  function demanderMotDePasse() {
    return new Promise((resoudre) => {
      const modale = SA.modale({
        titre: 'Confirmez votre mot de passe',
        sousTitre: "Cette action touche la configuration de l'IA. Un onglet resté ouvert ne suffit pas.",
        contenu: `
          <p class="sa-texte" style="margin-top:0">
            La confirmation ouvre une fenêtre de quelques minutes. Chaque usage de cette
            fenêtre est tracé, avec l'action qu'il a servi à autoriser.
          </p>
          <label class="sa-connexion-champ"><span>Mot de passe</span>
            <input type="password" class="sa-champ" id="ia-reauth-mdp" autocomplete="current-password"></label>`,
        actions: `
          <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
          <button class="sa-bouton sa-bouton-principal" data-role="ok">Confirmer</button>`
      });
      const champ = modale.querySelector('#ia-reauth-mdp');
      const valider = () => { const v = champ.value; modale.fermer(); resoudre(v || null); };
      modale.querySelector('[data-role="ok"]').addEventListener('click', valider);
      modale.querySelector('[data-role="annuler"]')
        .addEventListener('click', () => { modale.fermer(); resoudre(null); });
      champ.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') valider(); });
      setTimeout(() => champ.focus(), 30);
    });
  }

  const TONS_ETAT = {
    actif: 'succes',
    desactive: 'neutre',
    non_configure: 'neutre',
    mal_configure: 'danger',
    quota_depasse: 'alerte',
    indisponible: 'danger'
  };

  const LIBELLES_ETAT = {
    actif: 'Actif',
    desactive: 'Désactivé',
    non_configure: 'Non configuré',
    mal_configure: 'Mal configuré',
    quota_depasse: 'Quota dépassé',
    indisponible: 'Indisponible'
  };

  function badgeEtat(etat) {
    return ui.badge(LIBELLES_ETAT[etat] || etat, TONS_ETAT[etat] || 'neutre');
  }

  function argent(v) {
    const n = Number(v || 0);
    return `${n.toFixed(n < 1 && n > 0 ? 4 : 2)} $`;
  }

  function dateCourte(d) {
    if (!d) return null;
    return new Date(d).toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  }

  /* ======================================================================
     1. FOURNISSEURS
     ====================================================================== */

  SA.enregistrerVue('ia/fournisseurs', {
    titre: 'Fournisseurs IA',
    sousTitre: "Où Ardoise envoie ses requêtes. Les clés ne sont jamais réaffichées.",

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(6);

      let d;
      try {
        d = await SA.api(`${BASE}/fournisseurs`);
      } catch (err) {
        conteneur.innerHTML = ui.etatErreur(err.message);
        return;
      }

      const nonDeclares = d.catalogue.filter((c) => !c.deja_declare);

      conteneur.innerHTML = `
        ${d.avertissement_chiffrement ? `
          <div class="sa-bandeau ton-alerte">
            <strong>Stockage des clés en base indisponible.</strong>
            ${esc(d.avertissement_chiffrement)}
          </div>` : ''}

        <div class="ia-cartes-fournisseurs">
          ${d.fournisseurs.map(carteFournisseur).join('')}
        </div>

        ${nonDeclares.length ? `
          <section class="sa-section">
            <h3 class="sa-section-titre">Fournisseurs non déclarés</h3>
            <p class="sa-texte">
              Ardoise sait dialoguer avec ces services. Aucun n'est configuré : la liste
              montre ce qui est POSSIBLE, pas ce qui est branché.
            </p>
            <div class="ia-puces">
              ${nonDeclares.map((c) => `<span class="ia-puce">${esc(c.nom)}</span>`).join('')}
            </div>
          </section>` : ''}`;

      brancherFournisseurs(conteneur, d);
    }
  });

  function carteFournisseur(f) {
    const etat = f.etat_effectif || f.etat;
    const modeLibelle = {
      api: 'API serveur',
      subscription_connector: 'Connecteur d\'abonnement',
      local_developer_agent: 'Agent développeur local'
    }[f.mode] || f.mode;

    return `
      <article class="ia-carte-fournisseur" data-code="${esc(f.code)}">
        <header class="ia-carte-entete">
          <div>
            <h3>${esc(f.nom)}</h3>
            <p class="sa-muet">${esc(f.base_url || 'URL de base non renseignée')}</p>
          </div>
          ${badgeEtat(etat)}
        </header>

        <dl class="ia-carte-champs">
          <div><dt>Clé</dt><dd>
            ${f.cle_apercu
              ? `<code class="ia-cle">${esc(f.cle_apercu)}</code>`
              : (f.cle_presente
                  ? `<span class="sa-muet">via ${esc(f.variable_env)}</span>`
                  : '<span class="sa-muet">aucune</span>')}
            <span class="ia-source-cle">${esc({
              environnement: "variable d'environnement",
              base_chiffree: 'base, chiffrée',
              absente: '—'
            }[f.cle_source] || f.cle_source)}</span>
          </dd></div>
          <div><dt>Mode</dt><dd>${esc(modeLibelle)}</dd></div>
          <div><dt>Modèles</dt><dd>${f.nb_modeles_actifs} actif(s) sur ${f.nb_modeles}</dd></div>
          <div><dt>Budget mensuel</dt><dd>${f.budget_mensuel_usd > 0 ? argent(f.budget_mensuel_usd) : '<span class="sa-muet">aucun plafond</span>'}</dd></div>
          <div><dt>Dernière vérification</dt><dd>
            ${f.derniere_verification
              ? `${esc(dateCourte(f.derniere_verification))}${f.derniere_latence_ms ? ` · ${f.derniere_latence_ms} ms` : ''}`
              : '<span class="sa-muet">jamais testé</span>'}
          </dd></div>
        </dl>

        ${f.etat_detail ? `<p class="ia-etat-detail">${esc(f.etat_detail)}</p>` : ''}

        <footer class="ia-carte-actions">
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-action="tester">Tester</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-action="cle">
            ${f.cle_apercu ? 'Remplacer la clé' : 'Enregistrer une clé'}
          </button>
          <button class="sa-bouton sa-bouton-petit ${f.actif ? 'sa-bouton-secondaire' : 'sa-bouton-principal'}"
                  data-action="basculer">${f.actif ? 'Désactiver' : 'Activer'}</button>
        </footer>
      </article>`;
  }

  function brancherFournisseurs(conteneur, d) {
    conteneur.querySelectorAll('.ia-carte-fournisseur').forEach((carte) => {
      const code = carte.dataset.code;
      const f = d.fournisseurs.find((x) => x.code === code);

      carte.querySelector('[data-action="tester"]').addEventListener('click', async (ev) => {
        const bouton = ev.currentTarget;
        bouton.disabled = true;
        bouton.textContent = 'Test…';
        try {
          const r = await SA.api(`${BASE}/fournisseurs/${code}/tester`, { method: 'POST' });
          afficherResultatTest(f, r);
        } catch (err) {
          SA.toast(err.message, 'erreur');
        } finally {
          bouton.disabled = false;
          bouton.textContent = 'Tester';
        }
      });

      carte.querySelector('[data-action="cle"]').addEventListener('click', () => {
        ouvrirSaisieCle(f);
      });

      carte.querySelector('[data-action="basculer"]').addEventListener('click', async () => {
        try {
          await SA.api(`${BASE}/fournisseurs/${code}`, {
            method: 'PATCH', body: JSON.stringify({ actif: !f.actif })
          });
          SA.toast(`${f.nom} ${f.actif ? 'désactivé' : 'activé'}.`, 'succes');
          SA.rafraichirVue();
        } catch (err) {
          SA.toast(err.message, 'erreur');
        }
      });
    });
  }

  function afficherResultatTest(f, r) {
    SA.modale({
      titre: `Test — ${f.nom}`,
      sousTitre: 'Une requête très courte, facturée quelques centièmes de centime.',
      contenu: `
        <dl class="ia-resultat-test">
          <div><dt>Connexion</dt><dd>${ui.badge(r.connexion, r.connexion === 'OK' ? 'succes' : 'danger')}</dd></div>
          <div><dt>Modèle</dt><dd>${esc(r.modele || '—')} ${r.modele_accessible ? ui.badge('accessible', 'succes') : ui.badge('inaccessible', 'danger')}</dd></div>
          <div><dt>Latence</dt><dd>${r.latence_ms} ms</dd></div>
          <div><dt>Tool calling</dt><dd>${esc(r.tool_calling || '—')}</dd></div>
          <div><dt>Jetons renvoyés</dt><dd>${r.jetons_renvoyes
            ? ui.badge('oui — les coûts seront mesurés', 'succes')
            : ui.badge('non — les coûts resteront estimés', 'alerte')}</dd></div>
        </dl>
        ${r.message ? `<p class="sa-texte">${esc(r.message)}</p>` : ''}
        ${r.avertissement ? `<div class="sa-bandeau ton-alerte">${esc(r.avertissement)}</div>` : ''}
        <p class="sa-muet" style="margin-bottom:0">
          La clé n'apparaît nulle part dans ce rapport, ni dans les journaux qu'il produit.
        </p>`,
      actions: '<button class="sa-bouton sa-bouton-principal" data-role="fermer">Fermer</button>'
    }).querySelector('[data-role="fermer"]').addEventListener('click', function () {
      this.closest('.sa-voile').remove();
      SA.rafraichirVue();
    });
  }

  function ouvrirSaisieCle(f) {
    const modale = SA.modale({
      titre: `Clé API — ${f.nom}`,
      sousTitre: 'Elle sera chiffrée, et ne vous sera plus jamais réaffichée.',
      contenu: `
        <p class="sa-texte" style="margin-top:0">
          Une fois enregistrée, seule sa forme masquée sera visible
          (par exemple <code>sk-proj-••••••••••7Jd</code>). Le serveur ne la renvoie
          jamais au navigateur, y compris à vous.
        </p>
        ${f.variable_env ? `
          <div class="sa-bandeau ton-info">
            Cette clé vit actuellement dans la variable d'environnement
            <code>${esc(f.variable_env)}</code>. L'enregistrer ici la déplacera vers la base.
            Tant qu'elle ne change jamais, la variable d'environnement reste préférable.
          </div>` : ''}
        <label class="sa-connexion-champ"><span>Clé</span>
          <input type="password" class="sa-champ" id="ia-cle" autocomplete="off" spellcheck="false"></label>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok">Enregistrer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());
    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      const cle = modale.querySelector('#ia-cle').value.trim();
      if (!cle) return;
      try {
        const r = await avecReauthentification(() => SA.api(`${BASE}/fournisseurs/${f.code}/cle`, {
          method: 'PUT', body: JSON.stringify({ cle })
        }));
        if (!r) return;
        modale.fermer();
        SA.toast(r.message, 'succes');
        SA.rafraichirVue();
      } catch (err) {
        SA.toast(err.message, 'erreur');
      }
    });
    setTimeout(() => modale.querySelector('#ia-cle').focus(), 30);
  }

  /* ======================================================================
     2. MODÈLES
     ====================================================================== */

  SA.enregistrerVue('ia/modeles', {
    titre: 'Registre des modèles',
    sousTitre: "Capacités et tarifs. Les tarifs changent : la date de vérification est affichée.",

    async rendu(conteneur) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="ia-importer">
            Importer le catalogue
          </button>`;
      }

      conteneur.innerHTML = ui.squelette(8);
      let d;
      try {
        d = await SA.api(`${BASE}/modeles`);
      } catch (err) {
        conteneur.innerHTML = ui.etatErreur(err.message);
        return;
      }

      const bouton = document.getElementById('ia-importer');
      if (bouton) {
        bouton.addEventListener('click', async () => {
          bouton.disabled = true;
          try {
            const r = await SA.api(`${BASE}/modeles/importer-catalogue`, { method: 'POST' });
            SA.toast(r.message, 'succes', 9000);
            SA.rafraichirVue();
          } catch (err) {
            SA.toast(err.message, 'erreur');
          } finally {
            bouton.disabled = false;
          }
        });
      }

      const capacite = (m) => [
        m.supporte_texte ? 'texte' : null,
        m.supporte_image ? 'image' : null,
        m.supporte_fichiers ? 'fichiers' : null,
        m.supporte_outils ? 'outils' : null,
        m.supporte_raisonnement ? 'raisonnement' : null,
        m.supporte_streaming ? 'streaming' : null
      ].filter(Boolean);

      conteneur.innerHTML = `
        <div class="sa-bandeau ton-info">${esc(d.rappel)}</div>

        ${ui.tableau({
          colonnes: [
            { titre: 'Modèle', cle: 'nom', rendu: (m) => `
              <div class="ia-modele-nom">
                <strong>${esc(m.nom)}</strong>
                <code>${esc(m.identifiant)}</code>
              </div>` },
            { titre: 'Fournisseur', cle: 'fournisseur_nom', rendu: (m) =>
              `${esc(m.fournisseur_nom)} ${m.fournisseur_actif ? '' : ui.badge('inactif', 'neutre')}` },
            { titre: 'Capacités', cle: 'capacites', rendu: (m) =>
              `<div class="ia-puces">${capacite(m).map((c) => `<span class="ia-puce">${esc(c)}</span>`).join('')}</div>` },
            { titre: 'Contexte', cle: 'contexte_max', rendu: (m) =>
              m.contexte_max ? `${(m.contexte_max / 1000).toFixed(0)} k` : null },
            { titre: 'Prix (entrée / sortie)', cle: 'prix', rendu: (m) => {
              if (m.prix_entree_usd_million === null || m.prix_entree_usd_million === undefined) {
                return '<span class="sa-muet">non renseigné</span>';
              }
              return `<div class="ia-prix ${m.tarif_fiable ? '' : 'ia-prix-douteux'}">
                <span>${Number(m.prix_entree_usd_million).toFixed(2)} / ${Number(m.prix_sortie_usd_million).toFixed(2)} $ le M</span>
                ${m.tarif_note ? `<em title="${esc(m.tarif_note)}">${m.tarif_maj_at ? 'à revoir' : 'jamais vérifié'}</em>` : ''}
              </div>`;
            } },
            { titre: 'État', cle: 'actif', rendu: (m) =>
              ui.badge(m.actif ? 'actif' : 'inactif', m.actif ? 'succes' : 'neutre') },
            { titre: '', cle: 'actions', classe: 'sa-col-actions', rendu: (m) =>
              `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                       data-modifier="${esc(m.id)}">Modifier</button>` }
          ],
          lignes: d.modeles,
          vide: "Aucun modèle. Importez le catalogue, puis corrigez les tarifs."
        })}`;

      conteneur.querySelectorAll('[data-modifier]').forEach((b) => {
        b.addEventListener('click', () => {
          ouvrirEditionModele(d.modeles.find((m) => m.id === b.dataset.modifier));
        });
      });
    }
  });

  function ouvrirEditionModele(m) {
    const modale = SA.modale({
      titre: m.nom,
      sousTitre: esc(m.identifiant),
      large: true,
      contenu: `
        <div class="sa-bandeau ton-info">
          Corriger un prix DATE sa vérification. C'est cette date qui permettra plus tard
          de dire si le chiffre affiché est encore crédible.
        </div>
        <div class="ia-grille-formulaire">
          <label class="sa-connexion-champ"><span>Prix entrée ($ / M jetons)</span>
            <input type="number" step="0.0001" min="0" class="sa-champ" id="ia-prix-e"
                   value="${m.prix_entree_usd_million ?? ''}"></label>
          <label class="sa-connexion-champ"><span>Prix sortie ($ / M jetons)</span>
            <input type="number" step="0.0001" min="0" class="sa-champ" id="ia-prix-s"
                   value="${m.prix_sortie_usd_million ?? ''}"></label>
          <label class="sa-connexion-champ"><span>Prix cache ($ / M jetons)</span>
            <input type="number" step="0.0001" min="0" class="sa-champ" id="ia-prix-c"
                   value="${m.prix_cache_usd_million ?? ''}"></label>
          <label class="sa-connexion-champ"><span>Contexte maximal</span>
            <input type="number" min="1" class="sa-champ" id="ia-ctx" value="${m.contexte_max ?? ''}"></label>
        </div>
        <fieldset class="ia-capacites">
          <legend>Capacités</legend>
          ${[['supporte_image', 'Images'], ['supporte_fichiers', 'Fichiers'],
             ['supporte_outils', 'Outils / function calling'],
             ['supporte_raisonnement', 'Raisonnement'], ['supporte_streaming', 'Streaming'],
             ['actif', 'Modèle actif']].map(([cle, libelle]) => `
            <label class="sa-case"><input type="checkbox" data-cap="${cle}"
              ${m[cle] ? 'checked' : ''}> ${esc(libelle)}</label>`).join('')}
        </fieldset>
        <label class="sa-connexion-champ"><span>Usage conseillé</span>
          <textarea class="sa-champ" id="ia-conseil" rows="2">${esc(m.usage_conseille || '')}</textarea></label>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok">Enregistrer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());
    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      const corps = {
        contexte_max: modale.querySelector('#ia-ctx').value || null,
        usage_conseille: modale.querySelector('#ia-conseil').value
      };
      const lire = (id) => {
        const v = modale.querySelector(id).value;
        return v === '' ? null : Number(v);
      };
      corps.prix_entree_usd_million = lire('#ia-prix-e');
      corps.prix_sortie_usd_million = lire('#ia-prix-s');
      corps.prix_cache_usd_million = lire('#ia-prix-c');
      modale.querySelectorAll('[data-cap]').forEach((c) => { corps[c.dataset.cap] = c.checked; });

      try {
        await SA.api(`${BASE}/modeles/${m.id}`, { method: 'PATCH', body: JSON.stringify(corps) });
        modale.fermer();
        SA.toast('Modèle mis à jour. Le tarif est daté d\'aujourd\'hui.', 'succes');
        SA.rafraichirVue();
      } catch (err) {
        SA.toast(err.message, 'erreur');
      }
    });
  }

  /* ======================================================================
     3. ROUTAGE
     ====================================================================== */

  SA.enregistrerVue('ia/routage', {
    titre: 'Routage IA par fonction',
    sousTitre: "Quel modèle répond à quoi. Modifiable sans déploiement, et journalisé.",

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(10);
      let d;
      try {
        d = await SA.api(`${BASE}/routage`);
      } catch (err) {
        conteneur.innerHTML = ui.etatErreur(err.message);
        return;
      }

      const CATEGORIES = {
        super_admin: 'Super Admin',
        developpement: 'Développement',
        technique: 'Analyse technique',
        ecole: 'Écoles',
        client: 'Clients, parents et WhatsApp',
        commercial: 'Commercial'
      };

      const parCategorie = {};
      for (const u of d.usages) {
        (parCategorie[u.categorie] = parCategorie[u.categorie] || []).push(u);
      }

      conteneur.innerHTML = `
        <section class="sa-section">
          <h3 class="sa-section-titre">Profils</h3>
          <p class="sa-texte">
            Un profil est une indirection : quinze usages pointent vers STANDARD, on change
            le modèle de STANDARD une fois, les quinze suivent.
          </p>
          <div class="ia-profils">
            ${d.profils.map((p) => `
              <article class="ia-profil" data-profil="${esc(p.code)}">
                <header><strong>${esc(p.code)}</strong> <span class="sa-muet">${esc(p.libelle)}</span></header>
                <p class="sa-muet">${esc(p.description || '')}</p>
                <dl>
                  <div><dt>Modèle</dt><dd>${p.modele
                    ? `${esc(p.modele_nom)} <span class="sa-muet">${esc(p.fournisseur || '')}</span>`
                    : '<span class="sa-muet">non configuré</span>'}</dd></div>
                  <div><dt>Repli</dt><dd>${p.repli ? esc(p.repli_nom) : '<span class="sa-muet">aucun</span>'}</dd></div>
                </dl>
                <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-editer-profil="${esc(p.code)}">
                  Choisir le modèle
                </button>
              </article>`).join('')}
          </div>
        </section>

        ${Object.entries(parCategorie).map(([cat, liste]) => `
          <section class="sa-section">
            <h3 class="sa-section-titre">${esc(CATEGORIES[cat] || cat)}</h3>
            ${ui.tableau({
              colonnes: [
                { titre: 'Utilisation', cle: 'libelle', rendu: (u) => `
                  <div class="ia-usage-nom">
                    <strong>${esc(u.libelle)}</strong>
                    ${u.critique ? ui.badge('critique', 'alerte') : ''}
                    ${u.audience === 'public' ? ui.badge('public', 'info') : ''}
                    <span class="sa-muet">${esc(u.description || '')}</span>
                    ${u.declare_par ? `<code class="ia-appele-par">${esc(u.declare_par)}</code>` : ''}
                  </div>` },
                { titre: 'Profil', cle: 'profil_code', rendu: (u) =>
                  u.profil_code ? ui.badge(u.profil_code, 'neutre') : '<span class="sa-muet">—</span>' },
                { titre: 'Fournisseur / modèle', cle: 'resolution', rendu: (u) => {
                  const r = u.resolution || {};
                  if (!r.disponible) {
                    return `<span class="ia-indisponible" title="${esc(r.message || '')}">indisponible</span>`;
                  }
                  return `<div class="ia-resolution">
                    <span>${esc(r.fournisseur)}</span>
                    <code>${esc(r.modele)}</code>
                    ${r.depuis_environnement ? ui.badge('environnement', 'alerte') : ''}
                  </div>`;
                } },
                { titre: 'Repli', cle: 'fallback_autorise', rendu: (u) =>
                  u.fallback_autorise
                    ? `${ui.badge('autorisé', 'neutre')} <span class="sa-muet">${(u.resolution && u.resolution.nb_replis) || 0}</span>`
                    : ui.badge('interdit', 'alerte') },
                { titre: 'Budget / mois', cle: 'budget_mensuel_usd', rendu: (u) =>
                  Number(u.budget_mensuel_usd) > 0 ? argent(u.budget_mensuel_usd) : '<span class="sa-muet">aucun</span>' },
                { titre: '', cle: 'actions', classe: 'sa-col-actions', rendu: (u) =>
                  `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                           data-editer-usage="${esc(u.code)}">Régler</button>` }
              ],
              lignes: liste,
              vide: 'Aucun usage déclaré dans cette catégorie.'
            })}
          </section>`).join('')}`;

      conteneur.querySelectorAll('[data-editer-profil]').forEach((b) => {
        b.addEventListener('click', () =>
          ouvrirEditionProfil(d.profils.find((p) => p.code === b.dataset.editerProfil), d.modeles));
      });
      conteneur.querySelectorAll('[data-editer-usage]').forEach((b) => {
        b.addEventListener('click', () =>
          ouvrirEditionUsage(d.usages.find((u) => u.code === b.dataset.editerUsage), d));
      });
    }
  });

  function optionsModeles(modeles, selectionne, filtre) {
    return ['<option value="">— aucun —</option>']
      .concat(modeles.filter(filtre || (() => true)).map((m) => `
        <option value="${esc(m.id)}" ${m.id === selectionne ? 'selected' : ''}>
          ${esc(m.fournisseur)} · ${esc(m.nom)}${m.actif ? '' : ' (inactif)'}
        </option>`)).join('');
  }

  function ouvrirEditionProfil(p, modeles) {
    const modale = SA.modale({
      titre: `Profil ${p.code}`,
      sousTitre: p.libelle,
      contenu: `
        <label class="sa-connexion-champ"><span>Modèle principal</span>
          <select class="sa-champ" id="ia-p-modele">${optionsModeles(modeles, p.modele_id)}</select></label>
        <label class="sa-connexion-champ"><span>Modèle de repli</span>
          <select class="sa-champ" id="ia-p-repli">${optionsModeles(modeles, p.modele_repli_id)}</select></label>
        <p class="sa-muet">
          Le repli ne sert que pour les usages qui l'autorisent. Un usage critique n'en
          reçoit jamais, quel que soit ce réglage.
        </p>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok">Enregistrer</button>`
    });
    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());
    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      try {
        await SA.api(`${BASE}/routage/profils/${p.code}`, {
          method: 'PATCH',
          body: JSON.stringify({
            modele_id: modale.querySelector('#ia-p-modele').value || null,
            modele_repli_id: modale.querySelector('#ia-p-repli').value || null
          })
        });
        modale.fermer();
        SA.toast(`Profil ${p.code} mis à jour. Tous les usages qui le suivent changent avec lui.`, 'succes');
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });
  }

  function ouvrirEditionUsage(u, d) {
    const modale = SA.modale({
      titre: u.libelle,
      sousTitre: u.description,
      large: true,
      contenu: `
        ${u.audience === 'public' ? `
          <div class="sa-bandeau ton-info">
            Cet usage s'adresse au PUBLIC (parents, élèves, WhatsApp). Il passe
            obligatoirement par une API serveur officielle : ni abonnement personnel,
            ni agent local. Aucune base technique ou confidentielle ne lui est transmise.
          </div>` : ''}
        ${u.critique ? `
          <div class="sa-bandeau ton-alerte">
            Usage CRITIQUE : le repli y est interdit par conception. En cas
            d'indisponibilité, Ardoise répond « service indisponible » plutôt que de
            laisser un modèle moins capable rassurer à tort.
          </div>` : ''}

        <div class="ia-grille-formulaire">
          <label class="sa-connexion-champ"><span>Profil</span>
            <select class="sa-champ" id="ia-u-profil">
              <option value="">— aucun —</option>
              ${d.profils.map((p) => `<option value="${esc(p.code)}" ${p.code === u.profil_code ? 'selected' : ''}>${esc(p.code)}</option>`).join('')}
            </select></label>

          <label class="sa-connexion-champ"><span>Modèle épinglé (prime sur le profil)</span>
            <select class="sa-champ" id="ia-u-modele">${optionsModeles(d.modeles, u.modele_id)}</select></label>

          <label class="sa-connexion-champ"><span>Budget journalier ($)</span>
            <input type="number" min="0" step="0.01" class="sa-champ" id="ia-u-bj"
                   value="${u.budget_journalier_usd ?? 0}"></label>
          <label class="sa-connexion-champ"><span>Budget mensuel ($)</span>
            <input type="number" min="0" step="0.01" class="sa-champ" id="ia-u-bm"
                   value="${u.budget_mensuel_usd ?? 0}"></label>

          <label class="sa-connexion-champ"><span>Budget atteint</span>
            <select class="sa-champ" id="ia-u-budget-action">
              <option value="bloquer" ${u.action_budget_depasse === 'bloquer' ? 'selected' : ''}>Bloquer l'appel</option>
              <option value="basculer_economique" ${u.action_budget_depasse === 'basculer_economique' ? 'selected' : ''}>Basculer vers ÉCONOMIQUE</option>
            </select></label>

          <label class="sa-connexion-champ"><span>Température</span>
            <input type="number" min="0" max="2" step="0.1" class="sa-champ" id="ia-u-temp"
                   value="${u.temperature ?? ''}" placeholder="défaut du modèle"></label>
        </div>

        <label class="sa-case">
          <input type="checkbox" id="ia-u-fallback" ${u.fallback_autorise ? 'checked' : ''}
                 ${u.critique ? 'disabled' : ''}>
          Repli autorisé vers un autre modèle
          ${u.critique ? '<span class="sa-muet">(interdit : usage critique)</span>' : ''}
        </label>

        <p class="sa-muet">
          Zéro veut dire « aucun plafond ». Un budget à 0 n'est jamais « dépassé ».
          Le plus petit plafond réel est donc 0,01 $ : en dessous, le montant
          s'arrondirait à zéro et retirerait la limite au lieu de la poser.
        </p>
        <p class="sa-muet">Déclaré par : <code>${esc(u.declare_par || '—')}</code></p>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-secondaire" data-role="simuler">Simuler le routage</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok">Enregistrer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());

    modale.querySelector('[data-role="simuler"]').addEventListener('click', async () => {
      try {
        const r = await SA.api(`${BASE}/routage/simuler`, {
          method: 'POST', body: JSON.stringify({ usage: u.code })
        });
        SA.modale({
          titre: `Routage simulé — ${u.libelle}`,
          sousTitre: 'Ce qui se passerait maintenant. Aucun appel n\'est émis.',
          contenu: r.disponible ? `
            <ol class="ia-chaine">
              ${r.chaine.map((c) => `
                <li>
                  ${ui.badge(c.role, c.role === 'principal' ? 'succes' : 'neutre')}
                  <strong>${esc(c.fournisseur)}</strong> · <code>${esc(c.modele)}</code>
                  <span class="sa-muet">${esc(c.raison)}</span>
                </li>`).join('')}
            </ol>
            ${r.fallback_autorise ? '' : '<div class="sa-bandeau ton-alerte">Repli interdit : un seul candidat, par conception.</div>'}
            ${r.ecartes && r.ecartes.length ? `
              <h4>Écartés</h4>
              <ul class="sa-liste-simple">${r.ecartes.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}`
            : `<div class="sa-bandeau ton-danger">${esc(r.message)}</div>`,
          actions: '<button class="sa-bouton sa-bouton-principal" data-role="fermer">Fermer</button>'
        }).querySelector('[data-role="fermer"]').addEventListener('click', function () {
          this.closest('.sa-voile').remove();
        });
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });

    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      const temp = modale.querySelector('#ia-u-temp').value;
      const corps = {
        profil_code: modale.querySelector('#ia-u-profil').value || null,
        modele_id: modale.querySelector('#ia-u-modele').value || null,
        budget_journalier_usd: Number(modale.querySelector('#ia-u-bj').value) || 0,
        budget_mensuel_usd: Number(modale.querySelector('#ia-u-bm').value) || 0,
        action_budget_depasse: modale.querySelector('#ia-u-budget-action').value,
        temperature: temp === '' ? null : Number(temp)
      };
      if (!u.critique) corps.fallback_autorise = modale.querySelector('#ia-u-fallback').checked;

      try {
        const r = await SA.api(`${BASE}/routage/usages/${u.code}`, {
          method: 'PATCH', body: JSON.stringify(corps)
        });
        modale.fermer();
        SA.toast(
          r.resolution && r.resolution.disponible
            ? `${u.libelle} → ${r.resolution.fournisseur} / ${r.resolution.modele}`
            : 'Enregistré.',
          'succes');
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });
  }

  /* ======================================================================
     4. HISTORIQUE DU ROUTAGE
     ====================================================================== */

  SA.enregistrerVue('ia/historique', {
    titre: 'Historique des changements IA',
    sousTitre: "Ancien modèle, nouveau modèle, usage, auteur, date.",

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(8);
      let d;
      try {
        d = await SA.api(`${BASE}/routage/journal`);
      } catch (err) {
        conteneur.innerHTML = ui.etatErreur(err.message);
        return;
      }

      const valeur = (v) => {
        if (v === null || v === undefined) return '<span class="sa-muet">—</span>';
        if (typeof v !== 'object') return esc(String(v));
        return Object.entries(v)
          .filter(([, x]) => x !== null && x !== undefined)
          .map(([k, x]) => `<span class="ia-kv"><em>${esc(k)}</em> ${esc(String(x))}</span>`)
          .join(' ');
      };

      conteneur.innerHTML = `
        <p class="sa-texte">
          Sans cette trace, un changement de modèle serait indiscernable d'une dérive du
          modèle lui-même — et « pourquoi WhatsApp répond-il différemment depuis mardi ? »
          n'aurait pas de réponse.
        </p>
        ${ui.tableau({
          colonnes: [
            { titre: 'Date', cle: 'created_at', rendu: (l) => esc(dateCourte(l.created_at)) },
            { titre: 'Portée', cle: 'portee', rendu: (l) => ui.badge(l.portee, 'neutre') },
            { titre: 'Cible', cle: 'cible', rendu: (l) => `<code>${esc(l.cible)}</code>` },
            { titre: 'Avant', cle: 'avant', rendu: (l) => valeur(l.avant) },
            { titre: 'Après', cle: 'apres', rendu: (l) => valeur(l.apres) },
            { titre: 'Auteur', cle: 'auteur', rendu: (l) =>
              l.prenom || l.nom ? esc(`${l.prenom || ''} ${l.nom || ''}`.trim()) : '<span class="sa-muet">système</span>' },
            { titre: 'Motif', cle: 'motif' }
          ],
          lignes: d.changements,
          vide: "Aucun changement enregistré."
        })}`;
    }
  });

  /* ======================================================================
     5. COÛTS
     ====================================================================== */

  SA.enregistrerVue('ia/couts', {
    titre: "Coût de l'IA",
    sousTitre: "Par fournisseur, modèle, fonction, école et utilisateur.",

    async rendu(conteneur, params) {
      const jours = Number(params && params.jours) || 30;
      conteneur.innerHTML = ui.squeletteCartes(4) + ui.squelette(6);

      let d;
      try {
        d = await SA.api(`${BASE}/couts?jours=${jours}`);
      } catch (err) {
        conteneur.innerHTML = ui.etatErreur(err.message);
        return;
      }

      const tableauSimple = (titre, lignes, cleLibelle) => `
        <section class="sa-section">
          <h3 class="sa-section-titre">${esc(titre)}</h3>
          ${ui.tableau({
            colonnes: [
              { titre: cleLibelle, cle: 'cle' },
              { titre: 'Appels', cle: 'appels', classe: 'sa-col-nombre' },
              { titre: 'Coût', cle: 'cout', classe: 'sa-col-nombre',
                rendu: (l) => argent(l.cout) },
              { titre: 'Dont mesuré', cle: 'cout_mesure', classe: 'sa-col-nombre',
                rendu: (l) => (l.cout_mesure === undefined
                  ? '<span class="sa-muet">—</span>'
                  : argent(l.cout_mesure)) }
            ].filter((c) => c.cle !== 'cout_mesure' || lignes.some((l) => l.cout_mesure !== undefined)),
            lignes,
            vide: 'Aucune consommation sur la période.'
          })}
        </section>`;

      conteneur.innerHTML = `
        <div class="sa-filtres">
          ${[7, 30, 90, 365].map((j) => `
            <button class="sa-bouton sa-bouton-petit ${j === jours ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}"
                    data-jours="${j}">${j} jours</button>`).join('')}
        </div>

        <div class="sa-cartes-stats">
          ${ui.carteStat({ valeur: argent(d.total.usd), etiquette: 'Total sur la période',
                           detail: `${d.total.appels} appel(s)` })}
          ${ui.carteStat({ valeur: argent(d.total.mesure_usd), etiquette: 'Mesuré',
                           detail: 'jetons renvoyés par le fournisseur, tarif vérifié', ton: 'succes' })}
          ${ui.carteStat({ valeur: argent(d.total.estime_usd), etiquette: 'ESTIMATION',
                           detail: `${d.total.part_estimee_pct} % des appels`, ton: 'alerte' })}
          ${ui.carteStat({ valeur: String(d.budgets.length), etiquette: 'Budgets configurés' })}
        </div>

        <div class="sa-bandeau ton-alerte">${esc(d.avertissement)}</div>

        <section class="sa-section">
            <div class="ia-section-entete">
              <h3 class="sa-section-titre">Budgets</h3>
              <button class="sa-bouton sa-bouton-petit sa-bouton-secondaire"
                      data-role="nouveau-budget">Nouveau budget</button>
            </div>
            ${ui.tableau({
              cliquable: true,
              colonnes: [
                { titre: 'Budget', cle: 'libelle' },
                { titre: 'Portée', cle: 'portee', rendu: (b) => ui.badge(b.portee, 'neutre') },
                { titre: 'Dépensé ce mois', cle: 'depense_mois', classe: 'sa-col-nombre',
                  rendu: (b) => argent(b.depense_mois) },
                { titre: 'Plafond', cle: 'budget_mensuel_usd', classe: 'sa-col-nombre',
                  rendu: (b) => (Number(b.budget_mensuel_usd) > 0
                    ? argent(b.budget_mensuel_usd) : '<span class="sa-muet">aucun</span>') },
                { titre: 'Atteint', cle: 'atteint_pct', classe: 'sa-col-nombre',
                  rendu: (b) => (b.atteint_pct === null ? '<span class="sa-muet">—</span>'
                    : ui.badge(`${b.atteint_pct} %`,
                        b.atteint_pct >= 100 ? 'danger' : (b.atteint_pct >= b.seuil_alerte_pct ? 'alerte' : 'succes'))) },
                { titre: 'Dépassement', cle: 'bloquant',
                  rendu: (b) => (b.bloquant ? ui.badge('bloque', 'danger') : ui.badge('alerte seulement', 'neutre')) }
              ],
              lignes: d.budgets,
              vide: 'Aucun budget. Sans plafond, rien n’arrête une dépense.'
            })}
          </section>

        ${tableauSimple('Par fournisseur', d.par_fournisseur, 'Fournisseur')}
        ${tableauSimple('Par fonction', d.par_usage, 'Utilisation')}
        ${tableauSimple('Par modèle', d.par_modele, 'Modèle')}
        ${tableauSimple('Par école', d.par_ecole, 'École')}
        ${tableauSimple('Par utilisateur', d.par_utilisateur, 'Utilisateur')}`;

      conteneur.querySelectorAll('[data-jours]').forEach((b) => {
        b.addEventListener('click', () => SA.majParams({ jours: b.dataset.jours }) || SA.rafraichirVue());
      });

      const boutonNouveau = conteneur.querySelector('[data-role="nouveau-budget"]');
      if (boutonNouveau) boutonNouveau.addEventListener('click', () => ouvrirEditionBudget(null));

      conteneur.querySelectorAll('.sa-ligne-cliquable').forEach((tr) => {
        tr.addEventListener('click', () => {
          const b = d.budgets[Number(tr.dataset.index)];
          if (b) ouvrirEditionBudget(b);
        });
      });
    }
  });

  /**
   * Édition d'un budget.
   *
   * La route `PUT /budgets/:cle` existait depuis la première livraison, et
   * aucun écran ne l'appelait : les budgets s'affichaient, sans qu'aucun
   * plafond puisse être posé ni relevé depuis l'interface. Un plafond qu'on ne
   * peut pas modifier n'est pas un contrôle, c'est une décoration.
   */
  function ouvrirEditionBudget(b) {
    const creation = !b;
    const v = b || { cle: '', libelle: '', budget_mensuel_usd: 0, budget_journalier_usd: 0,
                     seuil_alerte_pct: 80, bloquant: false, portee: 'usage' };
    // Ces valeurs sont celles de la contrainte CHECK sur `ia_budgets.portee`.
    // En inventer une de plus ne produirait pas un budget plus fin : une 500.
    const PORTEES = ['global', 'fonction', 'fournisseur', 'ecole', 'usage'];

    const modale = SA.modale({
      titre: creation ? 'Nouveau budget' : v.libelle,
      sousTitre: creation ? '' : `clé : ${v.cle}`,
      contenu: `
        ${creation ? `
          <label class="sa-connexion-champ"><span>Clé technique</span>
            <input type="text" class="sa-champ" id="ia-b-cle" placeholder="ex. whatsapp_mensuel"></label>` : ''}
        <label class="sa-connexion-champ"><span>Libellé</span>
          <input type="text" class="sa-champ" id="ia-b-libelle" value="${esc(v.libelle)}"></label>

        <label class="sa-connexion-champ"><span>Portée</span>
          <select class="sa-champ" id="ia-b-portee">
            ${PORTEES.map((p) => `<option value="${p}" ${p === v.portee ? 'selected' : ''}>${p}</option>`).join('')}
          </select></label>

        <label class="sa-connexion-champ"><span>Plafond mensuel ($)</span>
          <input type="number" min="0" step="0.01" class="sa-champ" id="ia-b-bm"
                 value="${v.budget_mensuel_usd ?? 0}"></label>
        <label class="sa-connexion-champ"><span>Plafond journalier ($)</span>
          <input type="number" min="0" step="0.01" class="sa-champ" id="ia-b-bj"
                 value="${v.budget_journalier_usd ?? 0}"></label>
        <label class="sa-connexion-champ"><span>Seuil d'alerte (%)</span>
          <input type="number" min="1" max="200" step="1" class="sa-champ" id="ia-b-seuil"
                 value="${v.seuil_alerte_pct ?? 80}"></label>

        <label class="sa-case">
          <input type="checkbox" id="ia-b-bloquant" ${v.bloquant ? 'checked' : ''}>
          Bloquer les appels au dépassement (sinon : alerter seulement)
        </label>

        <p class="sa-muet">
          Zéro veut dire « aucun plafond ». Le plus petit plafond réel est 0,01 $ :
          en dessous, le montant s'arrondirait à zéro et retirerait la limite au
          lieu de la poser.
        </p>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok">Enregistrer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());
    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      const cle = creation ? modale.querySelector('#ia-b-cle').value.trim() : v.cle;
      if (!cle) return SA.toast('Une clé technique est obligatoire.', 'erreur');
      try {
        await SA.api(`${BASE}/budgets/${encodeURIComponent(cle)}`, {
          method: 'PUT',
          body: JSON.stringify({
            libelle: modale.querySelector('#ia-b-libelle').value.trim() || cle,
            portee: modale.querySelector('#ia-b-portee').value,
            budget_mensuel_usd: modale.querySelector('#ia-b-bm').value,
            budget_journalier_usd: modale.querySelector('#ia-b-bj').value,
            seuil_alerte_pct: Number(modale.querySelector('#ia-b-seuil').value) || 80,
            bloquant: modale.querySelector('#ia-b-bloquant').checked
          })
        });
        modale.fermer();
        SA.toast(creation ? 'Budget créé.' : 'Budget mis à jour.', 'succes');
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });
  }

  /* ======================================================================
     6. AUTORISATIONS — politiques et niveaux d'autonomie
     ====================================================================== */

  SA.enregistrerVue('ia/autorisations', {
    titre: 'Autorisations IA',
    sousTitre: "Ce que l'IA peut faire seule, et ce qui exige toujours un accord.",

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(10);
      let d;
      try {
        d = await SA.api(`${BASE}/politiques`);
      } catch (err) {
        conteneur.innerHTML = ui.etatErreur(err.message);
        return;
      }

      const LIBELLES = {
        automatique: 'automatique',
        selon_niveau: 'selon niveau',
        demander: 'demander',
        toujours_demander: 'toujours demander'
      };
      const TONS = {
        automatique: 'succes', selon_niveau: 'info',
        demander: 'alerte', toujours_demander: 'danger'
      };

      conteneur.innerHTML = `
        <div class="sa-bandeau ton-danger">
          <strong>Règle absolue.</strong> ${esc(d.regle_absolue)}
        </div>

        <section class="sa-section">
          <h3 class="sa-section-titre">Niveau d'autonomie, par domaine</h3>
          <p class="sa-texte">
            Les domaines sont indépendants : autoriser la base de connaissance pour la
            session ne change rien au code ni à la production.
          </p>
          <div class="ia-autonomies">
            ${d.autonomie.map((a) => `
              <article class="ia-autonomie ${a.expire ? 'expiree' : ''}" data-domaine="${esc(a.domaine)}">
                <header>
                  <strong>${esc(a.domaine)}</strong>
                  ${ui.badge(`niveau ${a.niveau}`, a.niveau === 0 ? 'neutre' : (a.niveau >= 3 ? 'alerte' : 'info'))}
                </header>
                <p class="ia-autonomie-nom">${esc(a.libelle)}</p>
                <p class="sa-muet">${esc(a.resume)}</p>
                ${a.expire_at ? `<p class="ia-echeance">${a.expire
                  ? `Expirée — retombé au mode proposition.`
                  : `Expire le ${esc(dateCourte(a.expire_at))}`}</p>` : ''}
                <p class="sa-muet">Automatisme plafonné à : ${a.plafond_automatique
                  ? esc(a.plafond_automatique) : 'rien'}</p>
                <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                        data-regler="${esc(a.domaine)}">Régler</button>
              </article>`).join('')}
          </div>
        </section>

        <section class="sa-section">
          <h3 class="sa-section-titre">Matrice des autorisations</h3>
          ${ui.tableau({
            colonnes: [
              { titre: 'Action', cle: 'libelle' },
              { titre: 'Catégorie', cle: 'categorie', rendu: (p) => ui.badge(p.categorie, 'neutre') },
              { titre: 'Danger', cle: 'niveau_danger', rendu: (p) => ui.badge(p.niveau_danger,
                  { LOW: 'succes', MEDIUM: 'info', HIGH: 'alerte', CRITICAL: 'danger' }[p.niveau_danger]) },
              { titre: 'Autorisation', cle: 'autorisation', rendu: (p) => `
                ${ui.badge(LIBELLES[p.autorisation] || p.autorisation, TONS[p.autorisation])}
                ${p.verrouillee ? '<span class="ia-verrou" title="Ne peut pas être rendue automatique">🔒</span>' : ''}` },
              { titre: '', cle: 'actions', classe: 'sa-col-actions', rendu: (p) => (p.modifiable
                ? `<select class="sa-champ sa-champ-petit" data-politique="${esc(p.action)}">
                     ${p.valeurs_possibles.map((v) => `<option value="${esc(v)}" ${v === p.autorisation ? 'selected' : ''}>${esc(LIBELLES[v] || v)}</option>`).join('')}
                   </select>`
                : `<span class="sa-muet" title="${esc(p.pourquoi_verrouillee || '')}">verrouillée</span>`) }
            ],
            lignes: d.matrice, vide: 'Matrice vide.'
          })}
        </section>`;

      conteneur.querySelectorAll('[data-politique]').forEach((s) => {
        s.addEventListener('change', async () => {
          try {
            await SA.api(`${BASE}/politiques/${s.dataset.politique}`, {
              method: 'PATCH', body: JSON.stringify({ autorisation: s.value })
            });
            SA.toast('Politique mise à jour.', 'succes');
            SA.rafraichirVue();
          } catch (err) {
            SA.toast(err.message, 'erreur');
            SA.rafraichirVue();
          }
        });
      });

      conteneur.querySelectorAll('[data-regler]').forEach((b) => {
        b.addEventListener('click', () =>
          ouvrirReglageAutonomie(d.autonomie.find((a) => a.domaine === b.dataset.regler), d));
      });
    }
  });

  function ouvrirReglageAutonomie(a, d) {
    const maxNiveau = a.domaine === 'production' ? 1 : 4;
    const modale = SA.modale({
      titre: `Autonomie — ${a.domaine}`,
      sousTitre: "Réglable par domaine. Une écriture autorisée expire d'elle-même.",
      large: true,
      contenu: `
        ${a.domaine === 'production' ? `
          <div class="sa-bandeau ton-danger">
            La mise en production reste une décision humaine. Ce domaine ne dépasse pas le
            niveau 1, quel que soit le réglage demandé.
          </div>` : ''}

        <div class="ia-niveaux">
          ${Object.entries(d.niveaux).filter(([n]) => Number(n) <= maxNiveau).map(([n, info]) => `
            <label class="ia-niveau ${Number(n) === a.niveau ? 'choisi' : ''}">
              <input type="radio" name="ia-niveau" value="${n}" ${Number(n) === a.niveau ? 'checked' : ''}>
              <div>
                <strong>Niveau ${n} — ${esc(info.nom)}</strong>
                <p class="sa-muet">${esc(info.resume)}</p>
                <p class="ia-plafond">Automatisme plafonné à : ${d.plafonds[n] ? esc(d.plafonds[n]) : 'rien'}</p>
              </div>
            </label>`).join('')}
        </div>

        <label class="sa-connexion-champ"><span>Durée (minutes, pour les niveaux 2 et plus)</span>
          <input type="number" min="5" max="480" class="sa-champ" id="ia-duree" value="60"></label>

        <label class="sa-connexion-champ"><span>Motif</span>
          <input type="text" class="sa-champ" id="ia-motif" placeholder="Pourquoi maintenant ?"></label>

        <p class="sa-muet">
          Le niveau 4 est prévu techniquement mais désactivé par défaut. Même à ce niveau :
          jamais de secrets, jamais la production, jamais de suppression massive, jamais les
          permissions Super Admin, jamais la désactivation du Quality Gate.
        </p>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok">Appliquer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());
    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      const choisi = modale.querySelector('input[name="ia-niveau"]:checked');
      if (!choisi) return;
      const niveau = Number(choisi.value);

      const corps = {
        niveau,
        duree_minutes: Number(modale.querySelector('#ia-duree').value) || 60,
        motif: modale.querySelector('#ia-motif').value || null
      };
      if (niveau === 4) {
        const ok = await SA.confirmer({
          titre: 'Activer le niveau 4 ?',
          message: "L'autonomie avancée est désactivée par défaut. Confirmez-vous en "
            + "comprendre les conséquences ?",
          libelleValider: 'Je comprends les risques', danger: true
        });
        if (!ok) return;
        corps.confirmation_niveau_4 = 'JE COMPRENDS LES RISQUES';
      }

      try {
        const r = await avecReauthentification(() =>
          SA.api(`${BASE}/autonomie/${a.domaine}`, { method: 'PUT', body: JSON.stringify(corps) }));
        if (!r) return;
        modale.fermer();
        SA.toast(r.message, 'succes', 8000);
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });
  }
}());

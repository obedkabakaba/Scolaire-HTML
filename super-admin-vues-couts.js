/* ==========================================================================
   Ardoise — Super Admin : Services, coûts, dépenses et budgets
   --------------------------------------------------------------------------
   Catalogue des services externes, consommations variables, dépenses,
   budgets, taux de change et calendrier de facturation.

   Aucun fournisseur n'est codé en dur. Supabase, Render, GitHub, Resend,
   OpenAI se saisissent ici comme n'importe quel autre service — et se
   remplacent sans déploiement.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui, graphe } = SA;
  const FIN = SA.finance || {};
  const argent = FIN.argent || ((v) => esc(v));
  const pourcent = FIN.pourcent || ((v) => `${esc(v)} %`);
  const formulaire = FIN.formulaire;
  const envoyer = FIN.envoyer;
  const listerOptions = FIN.options;

  const CATEGORIES_SERVICE = [
    'infrastructure', 'api', 'hebergement', 'domaine', 'communication',
    'logiciels', 'stockage', 'securite', 'autre'
  ];
  const CATEGORIES_DEPENSE = [
    'infrastructure', 'api', 'hebergement', 'domaine', 'marketing',
    'communication', 'logiciels', 'support', 'autres'
  ];

  const moisCourant = () => new Date().toISOString().slice(0, 7);

  /* ======================================================================
     1. Services & infrastructure
     ====================================================================== */

  const CHAMPS_SERVICE = (s = {}) => [
    { cle: 'nom', libelle: 'Nom du service', requis: true, valeur: s.nom, exemple: 'Ex. Base de données gérée' },
    { cle: 'fournisseur', libelle: 'Fournisseur', valeur: s.fournisseur },
    { cle: 'categorie', libelle: 'Catégorie', type: 'liste', valeur: s.categorie || 'autre',
      options: CATEGORIES_SERVICE },
    { cle: 'plan', libelle: 'Formule souscrite', valeur: s.plan, exemple: 'Ex. Pro, Team, Starter' },
    { cle: 'cout_mensuel', libelle: 'Coût par période facturée', type: 'nombre', min: 0, valeur: s.cout_mensuel ?? 0,
      aide: 'Le montant qui apparaît sur la facture, pour la fréquence choisie ci-dessous.' },
    { cle: 'devise', libelle: 'Devise', valeur: s.devise || 'USD', longueurMax: 8 },
    { cle: 'frequence_facturation', libelle: 'Fréquence', type: 'liste', valeur: s.frequence_facturation || 'mensuelle',
      options: [
        { valeur: 'mensuelle', libelle: 'Mensuelle' },
        { valeur: 'trimestrielle', libelle: 'Trimestrielle' },
        { valeur: 'annuelle', libelle: 'Annuelle' },
        { valeur: 'a_l_usage', libelle: "À l'usage (coût porté par les consommations)" },
        { valeur: 'ponctuelle', libelle: 'Ponctuelle (coût porté par les dépenses)' }
      ] },
    { cle: 'cout_annuel', libelle: 'Coût annuel (si facturation annuelle)', type: 'nombre', min: 0, valeur: s.cout_annuel },
    { cle: 'cout_variable', libelle: 'Coût variable', type: 'bascule', valeur: !!s.cout_variable,
      texteBascule: 'Le coût dépend de la consommation' },
    { cle: 'prix_unitaire', libelle: 'Prix unitaire', type: 'nombre', pas: '0.000001', min: 0, valeur: s.prix_unitaire,
      aide: 'Ex. prix pour 1 000 jetons, pour un e-mail, pour un Go.' },
    { cle: 'unite', libelle: 'Unité', valeur: s.unite, exemple: 'jetons, e-mails, Go…' },
    { cle: 'limite_incluse', libelle: 'Quantité incluse', type: 'nombre', min: 0, valeur: s.limite_incluse,
      aide: 'Seule la consommation au-delà de ce seuil est facturée.' },
    { cle: 'date_renouvellement', libelle: 'Prochain renouvellement', type: 'date',
      valeur: s.date_renouvellement ? String(s.date_renouvellement).slice(0, 10) : '' },
    { cle: 'jour_facturation', libelle: 'Jour de facturation', type: 'nombre', pas: '1', min: 1, max: 31, valeur: s.jour_facturation },
    { cle: 'url', libelle: 'Lien vers la console', valeur: s.url },
    { cle: 'critique', libelle: 'Service critique', type: 'bascule', valeur: !!s.critique,
      texteBascule: 'Une interruption arrête la plateforme' },
    { cle: 'notes', libelle: 'Notes', type: 'zone', valeur: s.notes,
      aide: 'N\'y écrivez jamais de clé d\'API ni de mot de passe : ce champ est affiché en clair.' }
  ];

  SA.enregistrerVue('couts/services', {
    titre: 'Services & infrastructure',
    sousTitre: 'Ce que la plateforme consomme, et ce que cela coûte.',

    async rendu(conteneur, params, reste) {
      if (reste && reste.length) return ficheService(conteneur, reste[0]);

      conteneur.innerHTML = ui.squeletteCartes(4) + ui.squelette(5, 60);

      const d = await SA.api(SA.url('/super-admin/services', { categorie: params.categorie, recherche: params.recherche }));
      if (FIN.devise) FIN.devise(d.devise_reference);

      const peut = d.peut_ecrire !== false;
      const t = d.totaux || {};

      const actions = document.getElementById('sa-entete-actions');
      if (actions && peut) {
        actions.innerHTML = '<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-nouveau">Ajouter un service</button>';
        const b = document.getElementById('btn-nouveau');
        if (b) b.addEventListener('click', () => formulaire({
          titre: 'Ajouter un service',
          sousTitre: 'Aucun fournisseur n\'est pré-rempli : saisissez ceux que vous utilisez réellement.',
          champs: CHAMPS_SERVICE(),
          libelleValider: 'Enregistrer',
          soumettre: (v) => envoyer('/super-admin/services', 'POST', v, 'Service enregistré.')
        }));
      }

      const colonnes = [
        { cle: 'nom', titre: 'Service', rendu: (l) => `
          <a href="#/couts/services/${esc(l.id)}"><strong>${esc(l.nom)}</strong></a>
          ${l.critique ? ' ' + ui.badge('critique', 'danger') : ''}
          <div class="sa-muet">${esc(l.fournisseur || '—')}${l.plan ? ` · ${esc(l.plan)}` : ''}</div>` },
        { cle: 'categorie', titre: 'Catégorie', rendu: (l) => ui.badge(l.categorie, 'neutre') },
        { cle: 'cout_mensuel_equivalent', titre: 'Coût fixe / mois', classe: 'sa-num', rendu: (l) => argent(l.cout_mensuel_equivalent) },
        { cle: 'cout_variable_mois', titre: 'Variable ce mois', classe: 'sa-num', rendu: (l) => {
          if (l.conso_a_renseigner) return '<span class="sa-manquant">à renseigner</span>';
          if (l.cout_variable_mois === null) return '<span class="sa-muet">—</span>';
          return argent(l.cout_variable_mois);
        } },
        { cle: 'variation_conso', titre: 'Évolution', classe: 'sa-num', rendu: (l) => {
          if (l.variation_conso === null) return '<span class="sa-muet">—</span>';
          const v = Number(l.variation_conso);
          return `<span class="${v > 0 ? 'sa-negatif' : 'sa-positif'}">${v > 0 ? '+' : ''}${fmt.decimal(v, 1)} %</span>`;
        } },
        { cle: 'cout_total_mois', titre: 'Total mois', classe: 'sa-num', rendu: (l) => `<strong>${argent(l.cout_total_mois)}</strong>` },
        { cle: 'date_renouvellement', titre: 'Renouvellement', rendu: (l) => {
          if (!l.date_renouvellement) return '<span class="sa-muet">non renseigné</span>';
          const j = Number(l.jours_avant_renouvellement);
          return `${esc(fmt.date(l.date_renouvellement))}<div class="sa-muet">${j < 0 ? 'passé' : `dans ${j} j`}</div>`;
        } },
        { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
        { cle: 'actions', titre: '', rendu: (l) => !peut ? '' : `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-conso="${esc(l.id)}">Consommation</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-modifier="${esc(l.id)}">Modifier</button>` }
      ];

      conteneur.innerHTML = `
        ${FIN.bandeauLecture ? FIN.bandeauLecture(d.peut_ecrire) : ''}
        <section class="sa-section">
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: argent(t.cout_fixe_mensuel), etiquette: 'Coûts fixes mensuels', icone: '🖥️' })}
            ${ui.carteStat({ valeur: argent(t.cout_variable_mensuel), etiquette: 'Coûts variables du mois', icone: '📶' })}
            ${ui.carteStat({ valeur: argent(t.cout_mensuel_total), etiquette: 'Total mensuel', ton: 'attention', icone: '💸' })}
            ${ui.carteStat({ valeur: argent(t.cout_annuel_projete), etiquette: 'Projection annuelle', icone: '📅' })}
          </div>
          ${Number(t.consommations_a_renseigner) ? `<div class="sa-encart-alerte">
            <strong>${fmt.nombre(t.consommations_a_renseigner)} service(s) à coût variable</strong> n'ont pas de consommation
            saisie pour ${esc(d.mois)}. Les coûts du mois sont donc sous-estimés, et la marge surestimée d'autant.
          </div>` : ''}
        </section>

        <section class="sa-section">
          <div class="sa-grille-2">
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Répartition par catégorie</h3>
              ${(d.par_categorie && d.par_categorie.length)
                ? graphe.barres(d.par_categorie.map((x) => ({ libelle: x.categorie, valeur: x.montant })),
                    { format: (v) => `${fmt.decimal(v, 2)} ${d.devise_reference}` })
                : ui.etatVide('Aucun coût enregistré')}
            </div>
            <div class="sa-panneau">
              <h3 class="sa-section-titre">Où va l'argent</h3>
              ${(d.par_categorie && d.par_categorie.length)
                ? graphe.repartition(d.par_categorie.map((x) => ({ libelle: x.categorie, valeur: x.montant })))
                : ui.etatVide('Aucun coût enregistré', 'Ajoutez vos services pour voir la répartition.')}
              <p class="sa-note">Les montants sont consolidés en ${esc(d.devise_reference)}
                ${d.conversion_approximative ? ' — sauf pour ' + esc((d.devises_sans_taux || []).join(', ')) + ', faute de taux saisi.' : '.'}</p>
            </div>
          </div>
        </section>

        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc"><span>Catégorie</span>
              <select class="sa-champ" id="filtre-categorie">
                <option value="">Toutes</option>
                ${CATEGORIES_SERVICE.map((c) => `<option value="${c}" ${params.categorie === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select></label>
            <label class="sa-champ-bloc"><span>Recherche</span>
              <input class="sa-champ" id="filtre-recherche" value="${esc(params.recherche || '')}" placeholder="Nom ou fournisseur" /></label>
          </div>
          ${ui.tableau({ colonnes, lignes: d.services, vide: 'Aucun service enregistré' })}
        </section>`;

      const majEtRendre = (p) => { SA.majParams(p); SA.rafraichirVue(); };

      const cat = document.getElementById('filtre-categorie');
      if (cat) cat.addEventListener('change', () => majEtRendre({ categorie: cat.value || undefined }));

      const rech = document.getElementById('filtre-recherche');
      if (rech) rech.addEventListener('input', SA.antiRebond(() => majEtRendre({ recherche: rech.value || undefined }), 380));

      const trouver = (id) => (d.services || []).find((s) => String(s.id) === String(id));

      conteneur.querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', () => {
        const s = trouver(b.dataset.modifier);
        formulaire({
          titre: `Modifier « ${s.nom} »`,
          champs: CHAMPS_SERVICE(s).concat([
            { cle: 'statut', libelle: 'Statut', type: 'liste', valeur: s.statut, options: [
              { valeur: 'actif', libelle: 'Actif' }, { valeur: 'suspendu', libelle: 'Suspendu' },
              { valeur: 'resilie', libelle: 'Résilié' }, { valeur: 'archive', libelle: 'Archivé' }
            ] },
            { cle: 'raison', libelle: 'Motif de la modification', type: 'zone', lignes: 2 }
          ]),
          soumettre: (v) => envoyer(`/super-admin/services/${s.id}`, 'PATCH', v, 'Service mis à jour.')
        });
      }));

      conteneur.querySelectorAll('[data-conso]').forEach((b) => b.addEventListener('click', () => {
        ouvrirConsommation(trouver(b.dataset.conso));
      }));
    }
  });

  /** Saisie d'une consommation mensuelle. */
  function ouvrirConsommation(s) {
    formulaire({
      titre: `Consommation — ${s.nom}`,
      sousTitre: 'Une seule ligne par service et par mois : ressaisir corrige, cela n\'ajoute pas.',
      large: false,
      champs: [
        { cle: 'periode', libelle: 'Mois', type: 'mois', requis: true, valeur: moisCourant() },
        { cle: 'quantite', libelle: `Quantité consommée${s.unite ? ` (${s.unite})` : ''}`, type: 'nombre', min: 0, requis: true },
        { cle: 'prix_unitaire', libelle: 'Prix unitaire', type: 'nombre', pas: '0.000001', min: 0, valeur: s.prix_unitaire,
          aide: 'Repris de la fiche du service. Modifiable si le tarif a changé ce mois-là.' },
        { cle: 'cout_reel', libelle: 'Coût réel facturé', type: 'nombre', min: 0,
          aide: 'À saisir dès réception de la facture. Tant qu\'il est vide, l\'estimation est utilisée.' },
        { cle: 'source', libelle: 'Origine', type: 'liste', options: [
          { valeur: 'manuel', libelle: 'Saisie manuelle' },
          { valeur: 'facture', libelle: 'Relevé sur la facture' },
          { valeur: 'automatique', libelle: 'Relevé automatique' }
        ] },
        { cle: 'note', libelle: 'Note', type: 'zone', lignes: 2 }
      ],
      libelleValider: 'Enregistrer',
      soumettre: (v) => envoyer(`/super-admin/services/${s.id}/consommations`, 'PUT', v, 'Consommation enregistrée.')
    });
  }

  /** Fiche détaillée d'un service. */
  async function ficheService(conteneur, id) {
    conteneur.innerHTML = ui.squelette(6, 60);
    const d = await SA.api(`/super-admin/services/${id}`);
    const s = d.service;

    const entete = document.getElementById('sa-entete');
    if (entete) {
      const h1 = entete.querySelector('h1');
      if (h1) h1.textContent = s.nom;
    }

    const actions = document.getElementById('sa-entete-actions');
    if (actions) {
      actions.innerHTML = `
        <a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/couts/services">← Tous les services</a>
        <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-conso">Saisir une consommation</button>`;
      const b = document.getElementById('btn-conso');
      if (b) b.addEventListener('click', () => ouvrirConsommation(s));
    }

    const colonnesConso = [
      { cle: 'periode', titre: 'Mois' },
      { cle: 'quantite', titre: 'Quantité', classe: 'sa-num', rendu: (l) => `${fmt.nombre(l.quantite)} ${esc(l.unite || '')}` },
      { cle: 'prix_unitaire', titre: 'Prix unitaire', classe: 'sa-num', rendu: (l) => l.prix_unitaire === null ? '—' : fmt.decimal(l.prix_unitaire, 6) },
      { cle: 'cout_estime', titre: 'Estimé', classe: 'sa-num', rendu: (l) => l.cout_estime === null ? '<span class="sa-muet">—</span>' : `${fmt.decimal(l.cout_estime, 2)} ${esc(l.devise)}` },
      { cle: 'cout_reel', titre: 'Réel', classe: 'sa-num', rendu: (l) => l.cout_reel === null ? '<span class="sa-manquant">non facturé</span>' : `<strong>${fmt.decimal(l.cout_reel, 2)} ${esc(l.devise)}</strong>` },
      { cle: 'ecart', titre: 'Écart', classe: 'sa-num', rendu: (l) => {
        if (l.cout_reel === null || l.cout_estime === null) return '<span class="sa-muet">—</span>';
        const e = Number(l.cout_reel) - Number(l.cout_estime);
        return `<span class="${e > 0 ? 'sa-negatif' : 'sa-positif'}">${e > 0 ? '+' : ''}${fmt.decimal(e, 2)}</span>`;
      } },
      { cle: 'source', titre: 'Origine', rendu: (l) => ui.badge(l.source, 'neutre') },
      { cle: 'saisi_par', titre: 'Par', rendu: (l) => esc(l.saisi_par || '—') }
    ];

    conteneur.innerHTML = `
      <section class="sa-section">
        <div class="sa-grille-2">
          <div class="sa-panneau">
            <h3 class="sa-section-titre">Fiche du service</h3>
            <div class="sa-liste-infos">
              <div class="sa-ligne-info"><span>Fournisseur</span><span>${esc(s.fournisseur || '—')}</span></div>
              <div class="sa-ligne-info"><span>Catégorie</span><span>${ui.badge(s.categorie, 'neutre')}</span></div>
              <div class="sa-ligne-info"><span>Formule</span><span>${esc(s.plan || '—')}</span></div>
              <div class="sa-ligne-info"><span>Coût facturé</span><span>${fmt.decimal(s.cout_mensuel, 2)} ${esc(s.devise)} · ${esc(s.frequence_facturation)}</span></div>
              <div class="sa-ligne-info"><span>Équivalent mensuel</span><span><strong>${fmt.decimal(s.cout_mensuel_equivalent, 2)} ${esc(s.devise)}</strong></span></div>
              <div class="sa-ligne-info"><span>Coût variable</span><span>${s.cout_variable ? 'oui' : 'non'}${s.prix_unitaire ? ` · ${fmt.decimal(s.prix_unitaire, 6)} / ${esc(s.unite || 'unité')}` : ''}</span></div>
              <div class="sa-ligne-info"><span>Quantité incluse</span><span>${s.limite_incluse === null ? '<span class="sa-muet">aucune</span>' : `${fmt.nombre(s.limite_incluse)} ${esc(s.unite || '')}`}</span></div>
              <div class="sa-ligne-info"><span>Renouvellement</span><span>${s.date_renouvellement ? esc(fmt.date(s.date_renouvellement)) : '<span class="sa-muet">non renseigné</span>'}</span></div>
              <div class="sa-ligne-info"><span>Statut</span><span>${ui.badgeStatut(s.statut)}${s.critique ? ' ' + ui.badge('critique', 'danger') : ''}</span></div>
              <div class="sa-ligne-info"><span>Console</span><span>${s.url ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">ouvrir ↗</a>` : '<span class="sa-muet">—</span>'}</span></div>
            </div>
            ${s.notes ? `<p class="sa-note">${esc(s.notes)}</p>` : ''}
            <p class="sa-note">Aucune clé d'API n'est stockée sur cette fiche. Les secrets restent dans
              <a href="#/configuration">Configuration</a>, où ils sont masqués.</p>
          </div>

          <div class="sa-panneau">
            <h3 class="sa-section-titre">Dépenses rattachées</h3>
            ${(d.depenses && d.depenses.length) ? `<div class="sa-liste-infos">
              ${d.depenses.map((x) => `<div class="sa-ligne-info">
                <span>${esc(fmt.date(x.date_depense))} — ${esc(x.libelle)}</span>
                <span>${fmt.decimal(x.montant, 2)} ${esc(x.devise)}
                  ${x.justificatif_url ? ` <a href="${esc(x.justificatif_url)}" target="_blank" rel="noopener">justificatif ↗</a>` : ''}</span>
              </div>`).join('')}
            </div>` : ui.etatVide('Aucune dépense rattachée', 'Les factures ponctuelles de ce service apparaîtront ici.')}
          </div>
        </div>
      </section>

      <section class="sa-section">
        <h2 class="sa-section-titre">Consommations mensuelles
          <span class="sa-annexe">estimation contre facture réelle</span></h2>
        ${ui.tableau({ colonnes: colonnesConso, lignes: d.consommations, vide: 'Aucune consommation saisie' })}
      </section>

      <section class="sa-section">
        <h2 class="sa-section-titre">Historique des modifications</h2>
        ${(d.historique && d.historique.length) ? `<div class="sa-conteneur-tableau">
          ${d.historique.map((h) => `<div class="sa-resultat">
            <span class="sa-resultat-icone">📝</span>
            <div class="sa-resultat-corps">
              <div class="sa-resultat-titre">${esc(String(h.action).replace(/[._]/g, ' '))} — ${esc(h.par || 'système')}</div>
              <div class="sa-resultat-detail">${esc(fmt.dateHeure(h.created_at))}${h.raison ? ` · ${esc(h.raison)}` : ''}</div>
            </div>
          </div>`).join('')}
        </div>` : ui.etatVide('Aucune modification enregistrée')}
      </section>`;
  }

  /* ======================================================================
     2. Dépenses
     ====================================================================== */

  SA.enregistrerVue('couts/depenses', {
    titre: 'Dépenses',
    sousTitre: 'Toutes les sorties d\'argent, avec leur justificatif.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(10, 46);

      const [d, services] = await Promise.all([
        SA.api(SA.url('/super-admin/depenses', {
          page: params.page, categorie: params.categorie, statut: params.statut,
          depuis: params.depuis, jusqu: params.jusqu, recherche: params.recherche,
          archivees: params.archivees
        })),
        SA.api('/super-admin/services').catch(() => ({ services: [] }))
      ]);

      const s = d.synthese || {};
      if (FIN.devise) FIN.devise(s.devise_reference);

      const champsDepense = (dep = {}) => [
        { cle: 'libelle', libelle: 'Libellé', requis: true, valeur: dep.libelle, exemple: 'Ex. Facture hébergement janvier' },
        { cle: 'montant', libelle: 'Montant', type: 'nombre', min: 0, requis: true, valeur: dep.montant },
        { cle: 'devise', libelle: 'Devise', valeur: dep.devise || 'USD', longueurMax: 8 },
        { cle: 'date_depense', libelle: 'Date', type: 'date', requis: true,
          valeur: dep.date_depense ? String(dep.date_depense).slice(0, 10) : new Date().toISOString().slice(0, 10) },
        { cle: 'categorie', libelle: 'Catégorie', type: 'liste', valeur: dep.categorie || 'autres', options: CATEGORIES_DEPENSE },
        { cle: 'service_id', libelle: 'Service rattaché', type: 'liste', valeur: dep.service_id,
          options: listerOptions(services.services, 'id', 'nom', 'Aucun'),
          aide: 'Rattacher évite le double comptage : la dépense d\'un service déjà facturé au forfait n\'est pas recomptée.' },
        { cle: 'fournisseur', libelle: 'Fournisseur', valeur: dep.fournisseur },
        { cle: 'recurrence', libelle: 'Récurrence', type: 'liste', valeur: dep.recurrence || 'ponctuelle', options: [
          { valeur: 'ponctuelle', libelle: 'Ponctuelle' }, { valeur: 'mensuelle', libelle: 'Mensuelle' },
          { valeur: 'trimestrielle', libelle: 'Trimestrielle' }, { valeur: 'annuelle', libelle: 'Annuelle' }
        ] },
        { cle: 'statut', libelle: 'Statut', type: 'liste', valeur: dep.statut || 'payee', options: [
          { valeur: 'payee', libelle: 'Payée' }, { valeur: 'prevue', libelle: 'Prévue' },
          { valeur: 'annulee', libelle: 'Annulée' }
        ] },
        { cle: 'justificatif_url', libelle: 'Lien vers le justificatif', valeur: dep.justificatif_url,
          aide: 'Lien vers la facture (stockage externe, boîte mail, drive).' },
        { cle: 'justificatif_nom', libelle: 'Nom du justificatif', valeur: dep.justificatif_nom },
        { cle: 'description', libelle: 'Description', type: 'zone', valeur: dep.description }
      ];

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = '<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-nouvelle">Nouvelle dépense</button>';
        const b = document.getElementById('btn-nouvelle');
        if (b) b.addEventListener('click', () => formulaire({
          titre: 'Enregistrer une dépense',
          champs: champsDepense(),
          soumettre: (v) => envoyer('/super-admin/depenses', 'POST', v, 'Dépense enregistrée.')
        }));
      }

      const colonnes = [
        { cle: 'date_depense', titre: 'Date', rendu: (l) => esc(fmt.date(l.date_depense)) },
        { cle: 'libelle', titre: 'Libellé', rendu: (l) => `${esc(l.libelle)}
          ${l.archive ? ' ' + ui.badge('archivée', 'neutre') : ''}
          <div class="sa-muet">${esc(l.fournisseur || l.service_nom || '—')}</div>` },
        { cle: 'categorie', titre: 'Catégorie', rendu: (l) => ui.badge(l.categorie, 'neutre') },
        { cle: 'montant', titre: 'Montant', classe: 'sa-num', rendu: (l) => `<strong>${fmt.decimal(l.montant, 2)} ${esc(l.devise)}</strong>` },
        { cle: 'recurrence', titre: 'Récurrence', rendu: (l) => l.recurrence === 'ponctuelle' ? '<span class="sa-muet">ponctuelle</span>' : ui.badge(l.recurrence, 'info') },
        { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut === 'payee' ? 'confirme' : l.statut === 'prevue' ? 'en_attente' : 'ignore') },
        { cle: 'justificatif', titre: 'Justificatif', rendu: (l) => l.justificatif_url
          ? `<a href="${esc(l.justificatif_url)}" target="_blank" rel="noopener">${esc(l.justificatif_nom || 'voir')} ↗</a>`
          : '<span class="sa-manquant">absent</span>' },
        { cle: 'actions', titre: '', rendu: (l) => l.archive ? '' : `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-modifier="${esc(l.id)}">Modifier</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-archiver="${esc(l.id)}" data-libelle="${esc(l.libelle)}">Archiver</button>` }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: argent(s.total_filtre), etiquette: 'Total sur le filtre courant', ton: 'attention', icone: '💸' })}
            ${(s.par_categorie || []).slice(0, 3).map((c) => ui.carteStat({
              valeur: argent(c.montant), etiquette: c.categorie, icone: '📂'
            })).join('')}
          </div>
        </section>

        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc"><span>Catégorie</span>
              <select class="sa-champ" id="filtre-categorie">
                <option value="">Toutes</option>
                ${CATEGORIES_DEPENSE.map((c) => `<option value="${c}" ${params.categorie === c ? 'selected' : ''}>${c}</option>`).join('')}
              </select></label>
            <label class="sa-champ-bloc"><span>Du</span>
              <input type="date" class="sa-champ sa-champ-date" id="filtre-depuis" value="${esc(params.depuis || '')}" /></label>
            <label class="sa-champ-bloc"><span>Au</span>
              <input type="date" class="sa-champ sa-champ-date" id="filtre-jusqu" value="${esc(params.jusqu || '')}" /></label>
            <label class="sa-champ-bloc"><span>Recherche</span>
              <input class="sa-champ" id="filtre-recherche" value="${esc(params.recherche || '')}" placeholder="Libellé ou fournisseur" /></label>
            <label class="sa-champ-inline" style="align-self:flex-end">
              <input type="checkbox" id="filtre-archivees" ${params.archivees === 'oui' ? 'checked' : ''} />
              <span>Inclure les archivées</span></label>
          </div>
          ${ui.tableau({ colonnes, lignes: d.donnees, vide: 'Aucune dépense' })}
          ${ui.pagination(d.pagination)}
          <p class="sa-note">
            Les dépenses ne se suppriment pas : elles s'archivent, avec un motif. Une dépense effacée
            modifierait rétroactivement une marge déjà consultée sans qu'aucune trace ne l'explique.
          </p>
        </section>`;

      const majEtRendre = (p) => { SA.majParams(p); SA.rafraichirVue(); };

      ['categorie', 'depuis', 'jusqu'].forEach((cle) => {
        const el = document.getElementById(`filtre-${cle}`);
        if (el) el.addEventListener('change', () => majEtRendre({ [cle]: el.value || undefined, page: 1 }));
      });
      const rech = document.getElementById('filtre-recherche');
      if (rech) rech.addEventListener('input', SA.antiRebond(() => majEtRendre({ recherche: rech.value || undefined, page: 1 }), 380));
      const arch = document.getElementById('filtre-archivees');
      if (arch) arch.addEventListener('change', () => majEtRendre({ archivees: arch.checked ? 'oui' : undefined, page: 1 }));

      conteneur.querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', () => {
        const dep = (d.donnees || []).find((x) => String(x.id) === String(b.dataset.modifier));
        formulaire({
          titre: `Modifier « ${dep.libelle} »`,
          champs: champsDepense(dep).concat([{ cle: 'raison', libelle: 'Motif de la modification', type: 'zone', lignes: 2 }]),
          soumettre: (v) => envoyer(`/super-admin/depenses/${dep.id}`, 'PATCH', v, 'Dépense mise à jour.')
        });
      }));

      conteneur.querySelectorAll('[data-archiver]').forEach((b) => b.addEventListener('click', () => {
        formulaire({
          titre: 'Archiver la dépense', large: false, danger: true,
          sousTitre: `« ${b.dataset.libelle} » restera consultable mais n'entrera plus dans les calculs de coûts.`,
          champs: [{ cle: 'raison', libelle: 'Motif', type: 'zone', lignes: 2, requis: true,
            aide: 'Obligatoire : doublon, erreur de saisie, dépense annulée…' }],
          libelleValider: 'Archiver',
          soumettre: (v) => envoyer(`/super-admin/depenses/${b.dataset.archiver}/archiver`, 'POST',
            Object.assign({ confirmation: true }, v), 'Dépense archivée.')
        });
      }));

      conteneur.querySelectorAll('[data-page]').forEach((b) =>
        b.addEventListener('click', () => majEtRendre({ page: b.dataset.page })));
    }
  });

  /* ======================================================================
     3. Budgets
     ====================================================================== */

  SA.enregistrerVue('couts/budgets', {
    titre: 'Budget',
    sousTitre: 'Ce qui était prévu, ce qui a été dépensé.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(6, 56);

      const periode = params.periode || moisCourant();
      const d = await SA.api(SA.url('/super-admin/budgets', { periode }));
      if (FIN.devise) FIN.devise(d.devise_reference);

      const peut = d.peut_ecrire !== false;

      const actions = document.getElementById('sa-entete-actions');
      if (actions && peut) {
        actions.innerHTML = '<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-budget">Définir un budget</button>';
        const b = document.getElementById('btn-budget');
        if (b) b.addEventListener('click', () => formulaire({
          titre: 'Définir un budget', large: false,
          sousTitre: 'Un budget par période et par catégorie. Redéfinir remplace la valeur précédente.',
          champs: [
            { cle: 'periode', libelle: 'Période', type: 'mois', requis: true, valeur: periode },
            { cle: 'categorie', libelle: 'Catégorie', type: 'liste', requis: true,
              options: (d.categories_disponibles || CATEGORIES_DEPENSE.concat('global')) },
            { cle: 'montant_prevu', libelle: 'Montant prévu', type: 'nombre', min: 0, requis: true },
            { cle: 'devise', libelle: 'Devise', valeur: d.devise_reference, longueurMax: 8 },
            { cle: 'note', libelle: 'Note', type: 'zone', lignes: 2 }
          ],
          soumettre: (v) => envoyer('/super-admin/budgets', 'PUT', v, 'Budget enregistré.')
        }));
      }

      const colonnes = [
        { cle: 'categorie', titre: 'Catégorie', rendu: (l) => l.categorie === 'global'
          ? '<strong>Ensemble des dépenses</strong>' : ui.badge(l.categorie, 'neutre') },
        { cle: 'montant_prevu', titre: 'Prévu', classe: 'sa-num', rendu: (l) => `${fmt.decimal(l.montant_prevu, 2)} ${esc(l.devise)}` },
        { cle: 'depense_reelle', titre: 'Dépensé', classe: 'sa-num', rendu: (l) => argent(l.depense_reelle) },
        { cle: 'reste', titre: 'Reste', classe: 'sa-num', rendu: (l) =>
          `<span class="${Number(l.reste) < 0 ? 'sa-negatif' : 'sa-positif'}">${fmt.decimal(l.reste, 2)}</span>` },
        { cle: 'pourcentage_consomme', titre: 'Consommé', classe: 'sa-num', rendu: (l) => {
          if (l.pourcentage_consomme === null) return '<span class="sa-muet">—</span>';
          const p = Number(l.pourcentage_consomme);
          const largeur = Math.min(100, p);
          const couleur = l.depassement ? 'var(--rouge)' : l.alerte ? 'var(--ocre)' : 'var(--vert-ok)';
          return `<div class="sa-jauge"><div class="sa-jauge-remplissage" style="width:${largeur}%;background:${couleur}"></div></div>
                  <div class="sa-muet">${fmt.decimal(p, 0)} %</div>`;
        } },
        { cle: 'etat', titre: 'État', rendu: (l) => l.depassement ? ui.badge('dépassé', 'danger')
          : l.alerte ? ui.badge('proche du seuil', 'attention') : ui.badge('dans le budget', 'succes') },
        { cle: 'note', titre: 'Note', rendu: (l) => esc(l.note || '—') }
      ];

      const t = d.totaux || {};

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc" style="max-width:200px"><span>Période</span>
              <input type="month" class="sa-champ sa-champ-date" id="filtre-periode" value="${esc(periode)}" /></label>
          </div>
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: argent(t.prevu), etiquette: 'Budget total prévu', icone: '🎯' })}
            ${ui.carteStat({ valeur: argent(t.reel), etiquette: 'Dépenses réelles', ton: Number(t.reel) > Number(t.prevu) ? 'danger' : null, icone: '💸' })}
            ${ui.carteStat({ valeur: argent(Number(t.prevu || 0) - Number(t.reel || 0)), etiquette: 'Écart', icone: '⚖️' })}
            ${ui.carteStat({ valeur: `${esc(d.seuil_alerte)} %`, etiquette: 'Seuil d\'alerte configuré', icone: '🔔' })}
          </div>
        </section>

        <section class="sa-section">
          ${ui.tableau({ colonnes, lignes: d.budgets, vide: 'Aucun budget défini pour cette période' })}
        </section>

        ${(d.categories_sans_budget && d.categories_sans_budget.length) ? `
        <section class="sa-section">
          <div class="sa-encart-alerte">
            <div class="sa-encart-titre">Dépenses hors budget</div>
            <p>Ces catégories ont été dépensées sans qu'un budget ait été défini pour ${esc(periode)} :</p>
            <ul class="sa-encart-liste">
              ${d.categories_sans_budget.map((c) => `<li><strong>${esc(c.categorie)}</strong> — ${argent(c.depense_reelle)}</li>`).join('')}
            </ul>
          </div>
        </section>` : ''}`;

      const p = document.getElementById('filtre-periode');
      if (p) p.addEventListener('change', () => { SA.majParams({ periode: p.value }); SA.rafraichirVue(); });
    }
  });

  /* ======================================================================
     4. Taux de change
     ====================================================================== */

  SA.enregistrerVue('couts/taux-change', {
    titre: 'Taux de change',
    sousTitre: 'Sans taux, les montants de devises différentes ne s\'additionnent pas correctement.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(5, 50);
      const d = await SA.api('/super-admin/taux-change');

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = '<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="btn-taux">Saisir un taux</button>';
        const b = document.getElementById('btn-taux');
        if (b) b.addEventListener('click', () => formulaire({
          titre: 'Saisir un taux de change', large: false,
          sousTitre: `Combien vaut une unité de la devise, exprimée en ${d.devise_reference} ?`,
          champs: [
            { cle: 'devise', libelle: 'Devise', requis: true, longueurMax: 8, exemple: 'Ex. CDF',
              valeur: (d.devises_sans_taux || [])[0] || '' },
            { cle: 'taux_vers_reference', libelle: `Valeur d'une unité en ${d.devise_reference}`,
              type: 'nombre', pas: '0.00000001', min: 0, requis: true,
              aide: `Exemple : si 1 unité vaut 0,00035 ${d.devise_reference}, saisissez 0,00035.` },
            { cle: 'date_effet', libelle: 'Date d\'effet', type: 'date', valeur: new Date().toISOString().slice(0, 10) },
            { cle: 'note', libelle: 'Source du taux', type: 'zone', lignes: 2,
              aide: 'Banque centrale, moyenne du marché, taux négocié…' }
          ],
          libelleValider: 'Enregistrer',
          soumettre: (v) => envoyer('/super-admin/taux-change', 'POST', v, 'Taux enregistré.')
        }));
      }

      const colonnes = [
        { cle: 'devise', titre: 'Devise', rendu: (l) => `<strong class="sa-mono">${esc(l.devise)}</strong>` },
        { cle: 'taux_vers_reference', titre: `Valeur en ${d.devise_reference}`, classe: 'sa-num',
          rendu: (l) => `<span class="sa-mono">${fmt.decimal(l.taux_vers_reference, 8)}</span>` },
        { cle: 'date_effet', titre: 'Date d\'effet', rendu: (l) => esc(fmt.date(l.date_effet)) },
        { cle: 'saisi_par_nom', titre: 'Saisi par', rendu: (l) => esc(l.saisi_par_nom || '—') },
        { cle: 'note', titre: 'Source', rendu: (l) => esc(l.note || '—') }
      ];

      conteneur.innerHTML = `
        <section class="sa-section">
          ${(d.devises_sans_taux && d.devises_sans_taux.length) ? `<div class="sa-encart-alerte">
            <div class="sa-encart-titre">Taux manquants</div>
            <p>Ces devises apparaissent dans vos paiements, offres, services ou dépenses, mais aucun taux vers
              <strong>${esc(d.devise_reference)}</strong> n'est saisi : <strong>${esc(d.devises_sans_taux.join(', '))}</strong>.
              En attendant, ces montants sont additionnés sans conversion, ce qui fausse les totaux.</p>
          </div>` : `<div class="sa-encart-info">
            <div class="sa-encart-titre">Consolidation complète</div>
            <p>Toutes les devises rencontrées disposent d'un taux vers ${esc(d.devise_reference)}.</p>
          </div>`}

          ${ui.tableau({ colonnes, lignes: d.taux, vide: 'Aucun taux saisi' })}

          <p class="sa-note">
            Le taux retenu pour un calcul est le plus récent dont la date d'effet est passée. Ardoise ne tient pas
            de comptabilité multidevise historique : les montants anciens sont convertis au taux courant, ce qui
            reste une approximation assumée. La devise de référence se change dans
            <a href="#/configuration">Configuration</a>, clé <span class="sa-mono">finance_devise_reference</span>.
          </p>
        </section>`;
    }
  });

  /* ======================================================================
     5. Calendrier de facturation
     ====================================================================== */

  SA.enregistrerVue('couts/calendrier', {
    titre: 'Calendrier de facturation',
    sousTitre: 'Ce qui va être prélevé, ce qui va être encaissé.',

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(8, 46);

      const jours = params.jours || 60;
      const d = await SA.api(SA.url('/super-admin/calendrier-facturation', { jours }));
      if (FIN.devise) FIN.devise(d.devise_reference);

      const colonnesSorties = [
        { cle: 'date_renouvellement', titre: 'Date', rendu: (l) => {
          const j = Number(l.jours_restants);
          return `${esc(fmt.date(l.date_renouvellement))}
                  <div class="sa-muet">${j < 0 ? `il y a ${Math.abs(j)} j` : j === 0 ? "aujourd'hui" : `dans ${j} j`}</div>`;
        } },
        { cle: 'nom', titre: 'Service', rendu: (l) => `${esc(l.nom)}<div class="sa-muet">${esc(l.fournisseur || '')}</div>` },
        { cle: 'categorie', titre: 'Catégorie', rendu: (l) => ui.badge(l.categorie, 'neutre') },
        { cle: 'frequence_facturation', titre: 'Fréquence' },
        { cle: 'montant_attendu', titre: 'Montant', classe: 'sa-num',
          rendu: (l) => `<span class="sa-negatif">−${fmt.decimal(l.montant_attendu, 2)} ${esc(l.devise)}</span>` }
      ];

      const colonnesEntrees = [
        { cle: 'date_expiration', titre: 'Échéance', rendu: (l) => {
          const j = Number(l.jours_restants);
          return `${esc(fmt.date(l.date_expiration))}
                  <div class="sa-muet">${j < 0 ? `échu depuis ${Math.abs(j)} j` : `dans ${j} j`}</div>`;
        } },
        { cle: 'ecole_nom', titre: 'École' },
        { cle: 'plan_nom', titre: 'Offre', rendu: (l) => esc(l.plan_nom || '—') },
        { cle: 'montant', titre: 'Montant attendu', classe: 'sa-num',
          rendu: (l) => `<span class="sa-positif">+${fmt.decimal(l.montant, 2)} ${esc(l.devise || '')}</span>` },
        { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) }
      ];

      const solde = Number(d.total_entrees_attendues || 0) - Number(d.total_sorties || 0);

      conteneur.innerHTML = `
        <section class="sa-section">
          <div class="sa-barre-filtres">
            <label class="sa-champ-bloc" style="max-width:200px"><span>Fenêtre</span>
              <select class="sa-champ" id="filtre-jours">
                ${[30, 60, 90, 180].map((j) => `<option value="${j}" ${String(jours) === String(j) ? 'selected' : ''}>${j} jours</option>`).join('')}
              </select></label>
          </div>
          <div class="sa-grille-stats">
            ${ui.carteStat({ valeur: argent(d.total_entrees_attendues), etiquette: 'Encaissements attendus', ton: 'succes', icone: '📥' })}
            ${ui.carteStat({ valeur: argent(d.total_sorties), etiquette: 'Prélèvements prévus', ton: 'attention', icone: '📤' })}
            ${ui.carteStat({ valeur: argent(solde), etiquette: 'Solde sur la période', ton: solde < 0 ? 'danger' : 'succes', icone: '⚖️' })}
          </div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Sorties — renouvellements de services</h2>
          ${ui.tableau({ colonnes: colonnesSorties, lignes: d.sorties, vide: 'Aucun renouvellement sur la période' })}
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Entrées — échéances d'abonnements</h2>
          ${ui.tableau({ colonnes: colonnesEntrees, lignes: d.entrees, vide: 'Aucune échéance sur la période' })}
        </section>

        ${(d.services_sans_date_renouvellement && d.services_sans_date_renouvellement.length) ? `
        <section class="sa-section">
          <div class="sa-encart-info">
            <div class="sa-encart-titre">Services sans date de renouvellement</div>
            <p>Ces services actifs n'apparaîtront jamais dans le calendrier tant que leur date n'est pas renseignée :</p>
            <ul class="sa-encart-liste">
              ${d.services_sans_date_renouvellement.map((s) =>
                `<li><a href="#/couts/services/${esc(s.id)}">${esc(s.nom)}</a>${s.fournisseur ? ` — ${esc(s.fournisseur)}` : ''}</li>`).join('')}
            </ul>
          </div>
        </section>` : ''}`;

      const sel = document.getElementById('filtre-jours');
      if (sel) sel.addEventListener('change', () => { SA.majParams({ jours: sel.value }); SA.rafraichirVue(); });
    }
  });
})();

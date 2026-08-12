/* ==========================================================================
   ARDOISE CONTROL CENTER — SUPERVISION
   --------------------------------------------------------------------------
   Vue d'ensemble (scores + priorités), journal technique, erreurs,
   performance, incidents, alertes, vérifications.

   PRINCIPE DE TOUTES CES VUES
   ---------------------------
   Aucune valeur affichée n'est inventée. Quand le serveur renvoie `null`, on
   affiche « — » et, quand c'est utile, la RAISON. Un tableau de bord qui
   affiche « 0 erreur » alors qu'il n'a rien pu mesurer est plus dangereux
   qu'un tableau de bord vide : il rassure.

   Chaque bloc porte donc sa source (`cc-source`), et chaque score sa
   décomposition, consultable au clic.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;

  /* ======================================================================
     Fonctions partagées
     ====================================================================== */

  /** Une carte de score, avec sa jauge et sa tendance. */
  function carteScore({ libelle, valeur, precedent, principal, cle }) {
    const etat = valeur >= 90 ? 'normal' : valeur >= 75 ? 'attention' : 'critique';
    let tendance = '';
    if (Number.isFinite(precedent) && precedent !== valeur) {
      const delta = valeur - precedent;
      tendance = `<div class="cc-score-tendance ${delta > 0 ? 'hausse' : 'baisse'}">`
        + `${delta > 0 ? '▲' : '▼'} ${Math.abs(delta)} pt depuis 7 jours</div>`;
    } else if (Number.isFinite(precedent)) {
      tendance = '<div class="cc-score-tendance">stable sur 7 jours</div>';
    }

    return `
      <div class="cc-score etat-${etat}${principal ? ' cc-score-principal' : ''} cc-cliquable"
           data-score="${esc(cle || '')}" role="button" tabindex="0">
        <div class="cc-score-libelle">${esc(libelle)}</div>
        <div class="cc-score-valeur">${valeur === null || valeur === undefined ? '—' : esc(valeur)}<span class="cc-sur">/100</span></div>
        <div class="cc-jauge"><span style="width:${Math.max(0, Math.min(100, Number(valeur) || 0))}%"></span></div>
        ${tendance}
      </div>`;
  }

  /** Décomposition d'un score : chaque pénalité, son poids, sa source. */
  function detailPenalites(titre, penalites, indisponibles) {
    const lignes = (penalites || []).map((p) => `
      <div class="cc-penalite">
        <div class="cc-penalite-points">${esc(p.points)}</div>
        <div class="cc-penalite-corps">
          <div class="cc-penalite-motif">${esc(p.motif)}</div>
          ${p.source ? `<div class="cc-penalite-source">source : ${esc(p.source)}</div>` : ''}
        </div>
      </div>`).join('');

    return `
      <p class="sa-texte" style="margin-top:0">
        Le score part de 100 et chaque anomalie retire des points. Voici
        exactement ce qui a été retiré, et d'où vient l'information.
      </p>
      ${lignes || '<div class="cc-aucune-penalite">Aucune pénalité : rien d\'anormal n\'a été mesuré sur cet axe.</div>'}
      ${(indisponibles && indisponibles.length) ? `
        <div class="cc-encart-hypothese">
          <strong>Sources non disponibles pour ce calcul :</strong><br>
          ${indisponibles.map((s) => esc(s)).join('<br>')}
          <br><br>Les pénalités correspondantes n'ont pas été appliquées. Le score
          est donc calculé sur un périmètre incomplet — ce n'est pas la même chose
          qu'un score parfait.
        </div>` : ''}`;
  }

  /** Badge fait / hypothèse. La distinction ne doit jamais être discrète. */
  function badgeConfiance(confiance) {
    return confiance === 'hypothese'
      ? '<span class="cc-confiance hypothese">hypothèse</span>'
      : '<span class="cc-confiance fait">fait</span>';
  }

  function badgeRegle(code) {
    if (!code) return '';
    return `<a class="cc-regle" href="#/cc/regles/${esc(code)}">${esc(code)}</a>`;
  }

  function paginationSimple(zone, route, requete) {
    zone.querySelectorAll('.sa-bouton-page[data-page]').forEach((bouton) => {
      if (bouton.disabled) return;
      bouton.addEventListener('click', () =>
        SA.naviguer(route, Object.assign({}, requete, { page: bouton.getAttribute('data-page') })));
    });
  }

  /* ======================================================================
     1. VUE D'ENSEMBLE — l'écran du matin
     ====================================================================== */

  SA.enregistrerVue('cc', {
    titre: 'Control Center',
    sousTitre: "Ardoise fonctionne-t-il correctement, et que faut-il traiter aujourd'hui ?",

    async rendu(conteneur) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="cc-btn-audit">Lancer un audit complet</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="cc-btn-verifs">Vérifier la santé</button>
          <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="cc-btn-ia">Demander à l'IA</button>`;
      }

      conteneur.innerHTML = ui.squeletteCartes(5) + ui.squelette(4, 90);

      const d = await SA.api('/super-admin/control-center/synthese');
      const s = d.scores || {};
      const p = d.priorites || {};
      const e = d.etat || {};

      // Comparaison au relevé le plus ancien de la courbe : « 86 » ne dit rien,
      // « 86 contre 94 lundi » dit tout.
      const evo = s.evolution || [];
      const ancien = evo.length > 1 ? evo[0] : null;

      const priorites = (p.top || []).map((c, i) => `
        <div class="cc-priorite gravite-${esc(c.gravite)}" data-constat="${esc(c.id)}">
          <div class="cc-priorite-rang">${i + 1}</div>
          <div class="cc-priorite-corps">
            <div class="cc-priorite-titre">${esc(c.titre)}</div>
            <div class="cc-priorite-meta">
              ${badgeConfiance(c.confiance)}
              ${ui.badge(c.type, 'neutre')}
              ${ui.badge(c.gravite, SA.ui.tonStatut(c.gravite))}
              ${badgeRegle(c.code_regle)}
              ${c.fichier ? `<span class="sa-mono">${esc(c.fichier)}${c.ligne ? ':' + esc(c.ligne) : ''}</span>` : ''}
              ${c.occurrences > 1 ? `<span>×${esc(c.occurrences)}</span>` : ''}
              ${c.statut === 'reapparu' ? ui.badge('réapparu', 'danger') : ''}
            </div>
          </div>
        </div>`).join('');

      const verifs = (e.verifications || []);
      const verifsEchec = verifs.filter((v) => v.statut === 'echec');

      conteneur.innerHTML = `
        ${d.maintenance_active ? `
          <div class="cc-bandeau-maintenance">
            <span><strong>Mode maintenance actif.</strong> Les écoles ne peuvent pas utiliser la plateforme.</span>
            <a class="sa-bouton sa-bouton-petit" href="#/cc/maintenance">Gérer</a>
          </div>` : ''}

        <div class="cc-scores">
          ${carteScore({ libelle: 'Score global', valeur: s.global, principal: true, cle: 'global',
                         precedent: ancien ? ancien.global : null })}
          ${carteScore({ libelle: 'Santé', valeur: s.sante, cle: 'sante',
                         precedent: ancien ? ancien.sante : null })}
          ${carteScore({ libelle: 'Sécurité', valeur: s.securite, cle: 'securite',
                         precedent: ancien ? ancien.securite : null })}
          ${carteScore({ libelle: 'Performance', valeur: s.performance, cle: 'performance',
                         precedent: ancien ? ancien.performance : null })}
          ${carteScore({ libelle: 'Données', valeur: s.donnees, cle: 'donnees',
                         precedent: ancien ? ancien.donnees : null })}
        </div>

        ${(s.sources_indisponibles && s.sources_indisponibles.length) ? `
          <div class="cc-encart-hypothese" style="margin-top:-8px">
            <strong>Attention : le score est calculé sur un périmètre incomplet.</strong><br>
            Sources non lues : ${s.sources_indisponibles.map((x) => esc(x)).join(' · ')}.
          </div>` : ''}

        <section class="sa-section">
          <h2 class="sa-section-titre">À traiter <span class="sa-annexe">par ordre de priorité calculée</span></h2>

          <div class="cc-paliers">
            ${['immediat', 'aujourd_hui', 'cette_semaine', 'plus_tard'].map((cle) => `
              <div class="cc-palier ${esc(cle)}" data-urgence="${esc(cle)}">
                <div class="cc-palier-nombre">${esc(fmt.nombre((p.par_palier || {})[cle] || 0))}</div>
                <div class="cc-palier-libelle">${esc((p.libelles || {})[cle] || cle)}</div>
              </div>`).join('')}
          </div>

          ${priorites || ui.etatVide('Aucun écart ouvert',
              "Aucun audit n'a encore tourné, ou tous les écarts sont traités. "
              + "Lancez un audit complet pour vérifier.")}
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">État instantané</h2>
          <div class="sa-grille-stats">
            ${ui.carteStat({
              valeur: (e.api || {}).requetes === 0 ? '—' : fmt.pourcent((e.api || {}).taux_erreur),
              etiquette: "Taux d'erreur (60 min)",
              detail: (e.api || {}).requetes === 0
                ? 'aucune requête mesurée'
                : `${fmt.nombre((e.api || {}).requetes_60min || (e.api || {}).requetes)} requêtes`,
              ton: (e.api || {}).taux_erreur > 2 ? 'danger' : 'succes'
            })}
            ${ui.carteStat({ valeur: fmt.duree((e.api || {}).latence_p95_ms), etiquette: 'Latence p95',
                             detail: `moyenne ${fmt.duree((e.api || {}).latence_moyenne_ms)}` })}
            ${ui.carteStat({ valeur: fmt.nombre(e.bugs_24h), etiquette: 'Erreurs sur 24 h',
                             detail: `${fmt.nombre(e.bugs_ouverts)} ouvertes au total`,
                             ton: e.bugs_24h > 0 ? 'attention' : 'succes' })}
            ${ui.carteStat({ valeur: fmt.nombre((e.incidents_ouverts || []).length), etiquette: 'Incidents ouverts',
                             ton: (e.incidents_ouverts || []).length ? 'danger' : 'succes' })}
            ${ui.carteStat({ valeur: fmt.nombre(e.alertes_actives), etiquette: 'Alertes non acquittées',
                             ton: e.alertes_actives > 0 ? 'attention' : 'succes' })}
            ${ui.carteStat({ valeur: fmt.nombre(e.ecoles_actives), etiquette: 'Écoles actives',
                             detail: `${fmt.nombre(e.sessions_ouvertes)} sessions ouvertes` })}
          </div>
          <div class="cc-source">
            ${esc(d.avertissement_metriques || '')}
          </div>
        </section>

        <div class="sa-grille-2">
          <section class="sa-panneau">
            <h3 class="sa-section-titre">Vérifications automatiques</h3>
            ${verifs.length ? verifs.map((v) => `
              <div class="cc-champ">
                <dt><span class="cc-voyant ${esc(v.statut)}"></span>${esc(v.cle)}</dt>
                <dd>${esc(v.message || '')}</dd>
              </div>`).join('')
              : ui.etatVide('Aucune vérification récente',
                  'Elles tournent toutes les 30 minutes. Vous pouvez en lancer une maintenant.')}
            ${verifsEchec.length ? `
              <div class="cc-encart-danger">
                ${verifsEchec.length} vérification(s) en échec. Elles pèsent directement
                sur le score de santé.
              </div>` : ''}
            <div class="cc-source">
              Source : table <span class="sa-mono">verifications_resultats</span>, dernier
              passage de chaque contrôle. Un contrôle « ignoré » n'a pas pu s'exécuter :
              il n'a rien prouvé.
            </div>
          </section>

          <section class="sa-panneau">
            <h3 class="sa-section-titre">Incidents en cours</h3>
            ${(e.incidents_ouverts || []).length
              ? (e.incidents_ouverts || []).map((i) => `
                  <div class="cc-priorite" data-incident="${esc(i.id)}">
                    <div class="cc-priorite-corps">
                      <div class="cc-priorite-titre">${esc(i.code)} — ${esc(i.titre)}</div>
                      <div class="cc-priorite-meta">
                        ${ui.badge(i.severite, SA.ui.tonStatut(i.severite))}
                        ${ui.badgeStatut(i.statut)}
                        <span>depuis ${esc(fmt.relatif(i.debut))}</span>
                        ${i.ecoles_touchees ? `<span>${esc(fmt.nombre(i.ecoles_touchees))} école(s)</span>` : ''}
                      </div>
                    </div>
                  </div>`).join('')
              : ui.etatVide('Aucun incident ouvert', 'Rien à signaler pour le moment.')}
          </section>
        </div>`;

      /* --- Décomposition d'un score au clic --- */
      const libelles = {
        global: 'Score global', sante: 'Santé', securite: 'Sécurité',
        performance: 'Performance', donnees: 'Données'
      };
      conteneur.querySelectorAll('[data-score]').forEach((carte) => {
        const ouvrir = () => {
          const cle = carte.getAttribute('data-score');
          if (cle === 'global') {
            SA.modale({
              titre: 'Comment le score global est calculé',
              large: true,
              contenu: `
                <p class="sa-texte">
                  Moyenne pondérée des quatre axes —
                  santé 30 %, sécurité 30 %, performance 20 %, données 20 % —
                  puis <strong>plafonnée au plus faible des axes majoré de 10</strong>.
                </p>
                <div class="cc-encart-fait">
                  Ce plafond n'est pas une subtilité gratuite : sans lui, on pourrait
                  afficher 88 avec une sécurité à 55, en compensant par trois axes à 99.
                  Une plateforme qui fuit n'est pas « bonne à 88 ».
                </div>
                <dl style="margin-top:16px">
                  ${['sante', 'securite', 'performance', 'donnees'].map((k) => `
                    <div class="cc-champ">
                      <dt>${esc(libelles[k])}</dt>
                      <dd><strong>${esc(s[k])}</strong> / 100 —
                        ${((s.penalites || {})[k] || []).length} pénalité(s)</dd>
                    </div>`).join('')}
                </dl>`
            });
            return;
          }
          SA.modale({
            titre: `${libelles[cle]} — ${s[cle]}/100`,
            sousTitre: 'Décomposition complète',
            large: true,
            contenu: detailPenalites(libelles[cle], (s.penalites || {})[cle], s.sources_indisponibles)
          });
        };
        carte.addEventListener('click', ouvrir);
        carte.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); ouvrir(); }
        });
      });

      conteneur.querySelectorAll('[data-urgence]').forEach((el) => {
        el.addEventListener('click', () =>
          SA.naviguer('cc/constats', { urgence: el.getAttribute('data-urgence') }));
      });
      conteneur.querySelectorAll('[data-constat]').forEach((el) => {
        el.addEventListener('click', () =>
          SA.naviguer(`cc/constats/${el.getAttribute('data-constat')}`));
      });
      conteneur.querySelectorAll('[data-incident]').forEach((el) => {
        el.addEventListener('click', () =>
          SA.naviguer(`cc/incidents/${el.getAttribute('data-incident')}`));
      });

      /* --- Actions d'en-tête --- */
      const btnAudit = document.getElementById('cc-btn-audit');
      if (btnAudit) {
        btnAudit.addEventListener('click', async () => {
          btnAudit.disabled = true;
          btnAudit.textContent = 'Audit en cours…';
          try {
            const r = await SA.api('/super-admin/control-center/audits/tout', { method: 'POST' });
            SA.toast(
              `Audit terminé : ${r.resume_global.constats} constat(s), `
              + `${r.resume_global.critiques} critique(s).`,
              r.resume_global.critiques ? 'attention' : 'succes', 8000);
            SA.rafraichirVue();
          } catch (err) {
            SA.toast(err.message || "L'audit n'a pas pu s'exécuter.", 'danger');
            btnAudit.disabled = false;
            btnAudit.textContent = 'Lancer un audit complet';
          }
        });
      }

      const btnVerifs = document.getElementById('cc-btn-verifs');
      if (btnVerifs) {
        btnVerifs.addEventListener('click', async () => {
          btnVerifs.disabled = true;
          btnVerifs.textContent = 'Vérification…';
          try {
            const r = await SA.api('/super-admin/control-center/verifications/executer', { method: 'POST' });
            SA.toast(
              `${r.resume.ok} contrôle(s) réussi(s), ${r.resume.echec} en échec, `
              + `${r.resume.ignore} non applicable(s).`,
              r.resume.echec ? 'danger' : 'succes', 8000);
            SA.rafraichirVue();
          } catch (err) {
            SA.toast(err.message || 'Vérification impossible.', 'danger');
            btnVerifs.disabled = false;
            btnVerifs.textContent = 'Vérifier la santé';
          }
        });
      }

      const btnIA = document.getElementById('cc-btn-ia');
      if (btnIA) btnIA.addEventListener('click', () => SA.naviguer('cc/copilote'));
    }
  });

  /* ======================================================================
     2. LOG EXPLORER
     ====================================================================== */

  SA.enregistrerVue('cc/logs', {
    titre: 'Explorateur de journaux',
    sousTitre: "Ce que le système fait, pas seulement ce qui plante. Secrets masqués à l'écriture.",

    async rendu(conteneur, params, segments) {
      // `#/cc/logs/<empreinte>` → fiche du groupe. Voir rendreDetailLog().
      if (segments && segments.length) {
        conteneur.innerHTML = ui.squelette(5);
        const detail = await SA.api(
          `/super-admin/control-center/logs/${encodeURIComponent(segments[0])}`);
        conteneur.innerHTML = rendreDetailLog(detail);
        return;
      }

      const requete = {
        categorie: params.categorie || '',
        niveau: params.niveau || '',
        q: params.q || '',
        heures: params.heures || '24',
        page: params.page || 1
      };

      conteneur.innerHTML = ui.squelette(10, 34);

      const d = await SA.api(SA.url('/super-admin/control-center/logs', requete));
      const filtres = d.filtres_disponibles || {};

      conteneur.innerHTML = `
        <div class="cc-filtres">
          <label class="cc-filtre cc-filtre-large">
            <span>Rechercher dans les messages</span>
            <input class="sa-champ" id="cc-log-q" value="${esc(requete.q)}" placeholder="ex. bulletin, paiement, timeout">
          </label>
          <label class="cc-filtre">
            <span>Catégorie</span>
            <select class="sa-champ" id="cc-log-categorie">
              <option value="">Toutes</option>
              ${(filtres.categories || []).map((c) =>
                `<option value="${esc(c)}"${requete.categorie === c ? ' selected' : ''}>${esc(c)}</option>`).join('')}
            </select>
          </label>
          <label class="cc-filtre">
            <span>Niveau</span>
            <select class="sa-champ" id="cc-log-niveau">
              <option value="">Tous</option>
              ${(filtres.niveaux || []).map((n) =>
                `<option value="${esc(n)}"${requete.niveau === n ? ' selected' : ''}>${esc(n)}</option>`).join('')}
            </select>
          </label>
          <label class="cc-filtre">
            <span>Période</span>
            <select class="sa-champ" id="cc-log-heures">
              ${[['1', 'Dernière heure'], ['24', '24 heures'], ['168', '7 jours'], ['720', '30 jours']]
                .map(([v, l]) => `<option value="${v}"${String(requete.heures) === v ? ' selected' : ''}>${l}</option>`).join('')}
            </select>
          </label>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="cc-log-export">Exporter (CSV)</button>
        </div>

        ${(d.regroupees || []).length ? `
          <section class="sa-section">
            <h2 class="sa-section-titre">Lignes identiques regroupées
              <span class="sa-annexe">« cette ligne est apparue N fois » est souvent l'information cherchée</span></h2>
            ${ui.tableau({
              colonnes: [
                { cle: 'occurrences', titre: '×', classe: 'sa-num', rendu: (l) => `<strong>${esc(fmt.nombre(l.occurrences))}</strong>` },
                { cle: 'categorie', titre: 'Catégorie', rendu: (l) => `<span class="cc-log-niveau ${esc(l.niveau)}">${esc(l.niveau)}</span> ${esc(l.categorie)}` },
                { cle: 'message', titre: 'Message', rendu: (l) => `<span class="sa-mono">${esc(String(l.message).slice(0, 150))}</span>` },
                { cle: 'derniere', titre: 'Dernière', rendu: (l) => esc(fmt.relatif(l.derniere)) },
                { cle: 'empreinte', titre: '', rendu: (l) => `<a class="sa-lien" href="#/cc/logs/${esc(l.empreinte)}">détail</a>` }
              ],
              lignes: d.regroupees, vide: 'Aucun regroupement'
            })}
          </section>` : ''}

        <section class="sa-section">
          <h2 class="sa-section-titre">Lignes <span class="sa-annexe">${esc(fmt.nombre(d.pagination.total))} au total</span></h2>
          <div class="cc-logs">
            ${(d.donnees || []).map((l) => `
              <div class="cc-log-ligne" data-empreinte="${esc(l.empreinte || '')}">
                <span class="cc-log-heure">${esc(fmt.dateHeure(l.horodatage))}</span>
                <span><span class="cc-log-niveau ${esc(l.niveau)}">${esc(l.niveau)}</span></span>
                <span class="cc-log-categorie">${esc(l.categorie)}</span>
                <span class="cc-log-message">${esc(l.message)}${
                  l.route ? `\n  ${esc(l.methode || '')} ${esc(l.route)}${l.code_http ? ` → ${esc(l.code_http)}` : ''}${l.duree_ms ? ` (${esc(l.duree_ms)} ms)` : ''}` : ''
                }</span>
              </div>`).join('') || ui.etatVide('Aucune ligne', 'Élargissez la période ou retirez des filtres.')}
          </div>
          ${ui.pagination(d.pagination)}
          <div class="cc-source">
            ${esc(d.note || '')}<br>
            Rétention par catégorie :
            ${Object.entries(d.retention || {}).map(([c, j]) => `${esc(c)} ${esc(j)} j`).join(' · ')}.
          </div>
        </section>`;

      const relancer = (modif) => SA.naviguer('cc/logs', Object.assign({}, requete, modif, { page: 1 }));

      const champQ = document.getElementById('cc-log-q');
      if (champQ) {
        champQ.addEventListener('keydown', (ev) => {
          if (ev.key === 'Enter') relancer({ q: champQ.value.trim() });
        });
      }
      ['categorie', 'niveau', 'heures'].forEach((nom) => {
        const el = document.getElementById(`cc-log-${nom}`);
        if (el) el.addEventListener('change', () => relancer({ [nom]: el.value }));
      });

      conteneur.querySelectorAll('.cc-log-ligne[data-empreinte]').forEach((el) => {
        const emp = el.getAttribute('data-empreinte');
        if (emp) el.addEventListener('click', () => SA.naviguer(`cc/logs/${emp}`));
      });

      const btnExport = document.getElementById('cc-log-export');
      if (btnExport) {
        btnExport.addEventListener('click', () => {
          // Export local à partir de ce qui est affiché : pas d'aller-retour
          // serveur, et surtout pas d'export massif involontaire — la page en
          // cours, et rien de plus.
          const entetes = ['horodatage', 'niveau', 'categorie', 'message', 'route', 'code_http', 'duree_ms'];
          const csv = [entetes.join(';')].concat((d.donnees || []).map((l) =>
            entetes.map((c) => `"${String(l[c] === null || l[c] === undefined ? '' : l[c]).replace(/"/g, '""')}"`).join(';')
          )).join('\n');
          const lien = document.createElement('a');
          lien.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
          lien.download = `ardoise-journaux-${new Date().toISOString().slice(0, 10)}.csv`;
          lien.click();
          URL.revokeObjectURL(lien.href);
          SA.toast(`${(d.donnees || []).length} ligne(s) exportée(s) — la page affichée uniquement.`, 'info');
        });
      }
    }
  });

  /* Fiche d'un groupe de lignes.

     Le routeur de `super-admin-noyau.js` résout `#/cc/logs/<empreinte>` en
     retirant les segments un à un jusqu'à trouver une vue enregistrée : il
     tombe donc sur `cc/logs` et transmet `['<empreinte>']` en troisième
     argument. Le détail se traite DANS la vue de liste, à partir de ce segment
     — enregistrer une vue `cc/logs/detail` ne serait jamais atteint, puisque
     l'URL ne contient pas le mot « detail ». */
  function rendreDetailLog(d) {
    const r = d.resume || {};
    const route = d.route_identifiee;
    return `
      <div class="sa-grille-stats" style="margin-bottom:18px">
        ${ui.carteStat({ valeur: fmt.nombre(r.occurrences), etiquette: 'Occurrences' })}
        ${ui.carteStat({ valeur: fmt.nombre(r.ecoles), etiquette: 'Écoles concernées' })}
        ${ui.carteStat({ valeur: fmt.relatif(r.premiere), etiquette: 'Première apparition' })}
        ${ui.carteStat({ valeur: fmt.relatif(r.derniere), etiquette: 'Dernière apparition' })}
      </div>

      ${route ? `
        <section class="sa-panneau">
          <h3 class="sa-section-titre">Code concerné</h3>
          <dl>
            <div class="cc-champ"><dt>Fichier de routes</dt><dd class="sa-mono">${esc(route.fichier)}:${esc(route.ligne)}</dd></div>
            <div class="cc-champ"><dt>Contrôleur</dt><dd class="sa-mono">${esc(route.controleur || '—')}</dd></div>
            <div class="cc-champ"><dt>Fonction</dt><dd class="sa-mono">${esc(route.fonction || '—')}</dd></div>
            <div class="cc-champ"><dt>Rôles autorisés</dt><dd>${route.roles_autorises ? route.roles_autorises.map((x) => ui.badge(x, 'neutre')).join(' ') : 'aucune restriction'}</dd></div>
          </dl>
          <div class="cc-encart-fait">${esc(d.note_rattachement || '')}</div>
        </section>` : `<div class="cc-encart-hypothese">${esc(d.note_rattachement || '')}</div>`}

      <section class="sa-section">
        <h2 class="sa-section-titre">Occurrences récentes</h2>
        <div class="cc-logs">
          ${(d.exemples || []).map((l) => `
            <div class="cc-log-ligne">
              <span class="cc-log-heure">${esc(fmt.dateHeure(l.horodatage))}</span>
              <span></span><span></span>
              <span class="cc-log-message">${esc(l.message)}${
                l.contexte && Object.keys(l.contexte).length
                  ? `\n  ${esc(JSON.stringify(l.contexte))}` : ''}</span>
            </div>`).join('')}
        </div>
      </section>`;
  }

  /* ======================================================================
     3. ERREURS
     ====================================================================== */

  SA.enregistrerVue('cc/erreurs', {
    titre: 'Suivi des erreurs',
    sousTitre: "Chaque erreur rattachée à sa route, son contrôleur et sa fonction.",

    async rendu(conteneur, params, segments) {
      if (segments && segments.length) return rendreFicheErreur(conteneur, segments[0]);

      const requete = {
        gravite: params.gravite || '', statut: params.statut || '',
        q: params.q || '', heures: params.heures || '168', page: params.page || 1
      };

      conteneur.innerHTML = ui.squelette(8);
      const d = await SA.api(SA.url('/super-admin/control-center/erreurs', requete));

      conteneur.innerHTML = `
        <div class="cc-filtres">
          <label class="cc-filtre cc-filtre-large"><span>Recherche</span>
            <input class="sa-champ" id="cc-err-q" value="${esc(requete.q)}" placeholder="message ou chemin"></label>
          <label class="cc-filtre"><span>Gravité</span>
            <select class="sa-champ" id="cc-err-gravite">
              <option value="">Toutes</option>
              ${['critique', 'haute', 'moyenne', 'basse'].map((g) =>
                `<option value="${g}"${requete.gravite === g ? ' selected' : ''}>${g}</option>`).join('')}
            </select></label>
          <label class="cc-filtre"><span>Statut</span>
            <select class="sa-champ" id="cc-err-statut">
              <option value="">Tous</option>
              ${['ouvert', 'resolu', 'ignore'].map((s) =>
                `<option value="${s}"${requete.statut === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select></label>
          <label class="cc-filtre"><span>Période</span>
            <select class="sa-champ" id="cc-err-heures">
              ${[['24', '24 h'], ['168', '7 jours'], ['720', '30 jours']].map(([v, l]) =>
                `<option value="${v}"${String(requete.heures) === v ? ' selected' : ''}>${l}</option>`).join('')}
            </select></label>
        </div>

        ${ui.tableau({
          colonnes: [
            { cle: 'occurrences', titre: '×', classe: 'sa-num', rendu: (l) => `<strong>${esc(fmt.nombre(l.occurrences))}</strong>` },
            { cle: 'gravite', titre: 'Gravité', rendu: (l) => ui.badge(l.gravite, SA.ui.tonStatut(l.gravite)) },
            { cle: 'message', titre: 'Erreur', rendu: (l) =>
              `<div>${esc(String(l.message).slice(0, 130))}</div>`
              + `<div class="sa-mono sa-annexe">${esc(l.methode || '')} ${esc(l.chemin || '')}${l.code_http ? ` → ${esc(l.code_http)}` : ''}</div>` },
            { cle: 'code', titre: 'Code concerné', rendu: (l) => l.code
              ? `<div class="sa-mono sa-annexe">${esc(l.code.controleur || '')}<br>${esc(l.code.fonction || '')}</div>`
              : '<span class="sa-muet">non rattachée</span>' },
            { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
            { cle: 'derniere_occurrence', titre: 'Dernière', rendu: (l) => esc(fmt.relatif(l.derniere_occurrence)) }
          ],
          lignes: d.donnees, cliquable: true,
          vide: 'Aucune erreur sur cette période'
        })}
        ${ui.pagination(d.pagination)}
        <div class="cc-source">${esc(d.note || '')}</div>`;

      const relancer = (modif) => SA.naviguer('cc/erreurs', Object.assign({}, requete, modif, { page: 1 }));
      const champQ = document.getElementById('cc-err-q');
      if (champQ) champQ.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') relancer({ q: champQ.value.trim() }); });
      ['gravite', 'statut', 'heures'].forEach((n) => {
        const el = document.getElementById(`cc-err-${n}`);
        if (el) el.addEventListener('change', () => relancer({ [n]: el.value }));
      });

      conteneur.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', () => SA.naviguer(`cc/erreurs/${tr.getAttribute('data-id')}`));
      });
      paginationSimple(conteneur, 'cc/erreurs', requete);
    }
  });

  async function rendreFicheErreur(conteneur, id) {
    {
      conteneur.innerHTML = ui.squelette(6);
      const d = await SA.api(`/super-admin/control-center/erreurs/${id}`);
      const e = d.erreur;
      const c = d.code;

      conteneur.innerHTML = `
        <section class="sa-panneau">
          <h3 class="sa-section-titre">${esc(String(e.message).slice(0, 160))}</h3>
          <dl>
            <div class="cc-champ"><dt>Route</dt><dd class="sa-mono">${esc(e.methode || '—')} ${esc(e.chemin || '—')}</dd></div>
            <div class="cc-champ"><dt>Code HTTP</dt><dd>${esc(e.code_http || '—')}</dd></div>
            <div class="cc-champ"><dt>Origine</dt><dd>${esc(e.origine)}</dd></div>
            <div class="cc-champ"><dt>Gravité / statut</dt><dd>${ui.badge(e.gravite, SA.ui.tonStatut(e.gravite))} ${ui.badgeStatut(e.statut)}</dd></div>
            <div class="cc-champ"><dt>Occurrences</dt><dd>${esc(fmt.nombre(e.occurrences))}</dd></div>
            <div class="cc-champ"><dt>Première</dt><dd>${esc(fmt.dateHeure(e.premiere_occurrence))}</dd></div>
            <div class="cc-champ"><dt>Dernière</dt><dd>${esc(fmt.dateHeure(e.derniere_occurrence))}</dd></div>
            <div class="cc-champ"><dt>Navigateur</dt><dd>${esc(e.navigateur || '—')}</dd></div>
          </dl>
        </section>

        ${c ? `
          <section class="sa-panneau">
            <h3 class="sa-section-titre">Code concerné</h3>
            <dl>
              <div class="cc-champ"><dt>Fichier de routes</dt><dd class="sa-mono">${esc(c.fichier_routes)}</dd></div>
              <div class="cc-champ"><dt>Contrôleur</dt><dd class="sa-mono">${esc(c.controleur || '—')}</dd></div>
              <div class="cc-champ"><dt>Fonction</dt><dd class="sa-mono">${esc(c.fonction || '—')}</dd></div>
              <div class="cc-champ"><dt>Rôles autorisés</dt><dd>${(c.roles_autorises || []).map((r) => ui.badge(r, 'neutre')).join(' ') || 'aucune restriction'}</dd></div>
              <div class="cc-champ"><dt>Middlewares</dt><dd class="sa-mono">${esc((c.middlewares || []).join(', '))}</dd></div>
            </dl>
            <div class="cc-encart-fait">
              Ce rattachement est un <strong>fait</strong> : il vient de l'analyse des
              fichiers de routes du déploiement en cours, pas d'une déduction.
            </div>
          </section>` : `
          <div class="cc-encart-hypothese">
            Aucune route du dépôt ne correspond exactement à ce chemin. Attribuer cette
            erreur à un contrôleur serait une hypothèse — l'interface s'en abstient.
          </div>`}

        ${e.stack ? `
          <section class="sa-section">
            <h2 class="sa-section-titre">Pile d'appels <span class="sa-annexe">secrets masqués</span></h2>
            <pre class="cc-code">${esc(e.stack)}</pre>
          </section>` : ''}

        <section class="sa-section">
          <h2 class="sa-section-titre">Actions</h2>
          <div style="display:flex;flex-wrap:wrap;gap:9px">
            <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="cc-err-ia">Demander l'analyse de l'IA</button>
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="cc-err-incident">Ouvrir un incident</button>
            <a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="#/cc/logs?q=${encodeURIComponent(String(e.message).slice(0, 40))}">Voir les journaux liés</a>
          </div>
          <div class="cc-source">
            Aucune de ces actions ne modifie le code ni les données : l'analyse produit
            un texte, l'incident une fiche de suivi.
          </div>
        </section>

        <div id="cc-err-analyse"></div>

        ${(d.commentaires || []).length ? `
          <section class="sa-section">
            <h2 class="sa-section-titre">Historique et analyses</h2>
            ${(d.commentaires || []).map((k) => `
              <div class="sa-panneau" style="margin-bottom:10px">
                <div class="sa-annexe">${esc(k.auteur || 'Système')} — ${esc(fmt.dateHeure(k.created_at))}</div>
                <div style="white-space:pre-wrap;margin-top:7px;font-size:.88rem;line-height:1.6">${esc(k.contenu)}</div>
              </div>`).join('')}
          </section>` : ''}`;

      const btnIA = document.getElementById('cc-err-ia');
      if (btnIA) {
        btnIA.addEventListener('click', async () => {
          btnIA.disabled = true;
          btnIA.textContent = 'Analyse en cours…';
          const zone = document.getElementById('cc-err-analyse');
          zone.innerHTML = '<div class="sa-panneau">' + ui.squelette(4, 24) + '</div>';
          try {
            const r = await SA.api(`/super-admin/control-center/ia/analyser-erreur/${e.id}`, { method: 'POST' });
            zone.innerHTML = `
              <section class="sa-section">
                <h2 class="sa-section-titre">Analyse de l'IA
                  <span class="sa-annexe">${esc(r.modele)} · ${esc(fmt.duree(r.duree_ms))}</span></h2>
                <div class="sa-panneau" style="white-space:pre-wrap;line-height:1.65;font-size:.89rem">${esc(r.analyse)}</div>
                <div class="cc-encart-hypothese">${esc(r.avertissement)}</div>
              </section>`;
          } catch (err) {
            zone.innerHTML = `<div class="cc-encart-danger">${esc(err.message)}</div>`;
          } finally {
            btnIA.disabled = false;
            btnIA.textContent = "Demander l'analyse de l'IA";
          }
        });
      }

      const btnInc = document.getElementById('cc-err-incident');
      if (btnInc) {
        btnInc.addEventListener('click', () => {
          const modale = SA.modale({
            titre: 'Ouvrir un incident',
            contenu: `
              <label class="sa-connexion-champ"><span>Titre</span>
                <input class="sa-champ" id="cc-inc-titre" value="${esc(String(e.message).slice(0, 120))}"></label>
              <label class="sa-connexion-champ"><span>Sévérité</span>
                <select class="sa-champ" id="cc-inc-severite">
                  <option value="moyenne">Moyenne</option>
                  <option value="haute">Haute</option>
                  <option value="critique">Critique</option>
                  <option value="basse">Basse</option>
                </select></label>
              <label class="sa-connexion-champ"><span>Cause probable (facultatif)</span>
                <input class="sa-champ" id="cc-inc-cause"></label>`,
            actions: `<button class="sa-bouton sa-bouton-principal" data-role="creer">Ouvrir l'incident</button>`
          });
          modale.querySelector('[data-role="creer"]').addEventListener('click', async () => {
            try {
              const inc = await SA.api('/super-admin/control-center/incidents', {
                method: 'POST',
                body: JSON.stringify({
                  titre: document.getElementById('cc-inc-titre').value,
                  severite: document.getElementById('cc-inc-severite').value,
                  cause_probable: document.getElementById('cc-inc-cause').value || null,
                  bugs_lies: [e.id]
                })
              });
              modale.fermer();
              SA.toast(`Incident ${inc.code} ouvert.`, 'succes');
              SA.naviguer(`cc/incidents/${inc.id}`);
            } catch (err) { SA.toast(err.message, 'danger'); }
          });
        });
      }
    }
  }

  /* ======================================================================
     4. PERFORMANCE
     ====================================================================== */

  SA.enregistrerVue('cc/performance', {
    titre: 'Performance',
    sousTitre: 'Latences, routes lentes, base de données, index.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(6, 90);
      const d = await SA.api('/super-admin/control-center/performance');
      const api = d.api || {};
      const bdd = d.base_de_donnees || {};
      const inter = d.interpretation || {};

      conteneur.innerHTML = `
        <div class="sa-grille-stats" style="margin-bottom:20px">
          ${ui.carteStat({ valeur: fmt.duree(api.latence_p50_ms), etiquette: 'Médiane (p50)' })}
          ${ui.carteStat({ valeur: fmt.duree(api.latence_p95_ms), etiquette: 'p95',
                           detail: 'le vingtième le plus mal servi',
                           ton: api.latence_p95_ms > 800 ? 'attention' : 'succes' })}
          ${ui.carteStat({ valeur: fmt.duree(api.latence_p99_ms), etiquette: 'p99',
                           ton: api.latence_p99_ms > 3000 ? 'danger' : 'succes' })}
          ${ui.carteStat({ valeur: fmt.nombre(api.requetes_lentes), etiquette: `Requêtes > ${esc(api.seuil_lenteur_ms)} ms` })}
          ${ui.carteStat({ valeur: fmt.nombre(bdd.verrous_non_accordes), etiquette: 'Verrous bloquants',
                           ton: bdd.verrous_non_accordes ? 'danger' : 'succes' })}
          ${ui.carteStat({ valeur: fmt.octets(bdd.taille_journal_technique_octets), etiquette: 'Taille du journal technique' })}
        </div>

        <div class="sa-grille-2">
          <section class="sa-panneau">
            <h3 class="sa-section-titre">Routes les plus lentes</h3>
            ${ui.tableau({
              colonnes: [
                { cle: 'route', titre: 'Route', classe: 'sa-mono' },
                { cle: 'nb', titre: 'Appels', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb) },
                { cle: 'moyenne_ms', titre: 'Moyenne', classe: 'sa-num', rendu: (l) => esc(fmt.duree(l.moyenne_ms)) },
                { cle: 'max_ms', titre: 'Pire', classe: 'sa-num', rendu: (l) => esc(fmt.duree(l.max_ms)) }
              ], lignes: api.routes_les_plus_lentes || [], vide: 'Aucune mesure'
            })}
          </section>
          <section class="sa-panneau">
            <h3 class="sa-section-titre">Routes les plus appelées</h3>
            ${ui.tableau({
              colonnes: [
                { cle: 'route', titre: 'Route', classe: 'sa-mono' },
                { cle: 'nb', titre: 'Appels', classe: 'sa-num', rendu: (l) => fmt.nombre(l.nb) },
                { cle: 'moyenne_ms', titre: 'Moyenne', classe: 'sa-num', rendu: (l) => esc(fmt.duree(l.moyenne_ms)) },
                { cle: 'erreurs', titre: 'Erreurs', classe: 'sa-num', rendu: (l) => fmt.nombre(l.erreurs) }
              ], lignes: api.routes_les_plus_appelees || [], vide: 'Aucune mesure'
            })}
          </section>
        </div>

        <section class="sa-section">
          <h2 class="sa-section-titre">Index potentiellement manquants</h2>
          ${(bdd.index_potentiellement_manquants || []).length ? ui.tableau({
            colonnes: [
              { cle: 'table', titre: 'Table', classe: 'sa-mono' },
              { cle: 'balayages_sequentiels', titre: 'Balayages séquentiels', classe: 'sa-num', rendu: (l) => fmt.nombre(l.balayages_sequentiels) },
              { cle: 'balayages_index', titre: 'Balayages par index', classe: 'sa-num', rendu: (l) => fmt.nombre(l.balayages_index) },
              { cle: 'lignes', titre: 'Lignes', classe: 'sa-num', rendu: (l) => fmt.nombre(l.lignes) }
            ], lignes: bdd.index_potentiellement_manquants, vide: ''
          }) : ui.etatVide('Aucun candidat', 'Aucune table ne présente le motif recherché.')}
          <div class="cc-encart-hypothese">${esc(inter.index_potentiellement_manquants || '')}</div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Index peu utilisés</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'table_nom', titre: 'Table', classe: 'sa-mono' },
              { cle: 'index_nom', titre: 'Index', classe: 'sa-mono' },
              { cle: 'balayages', titre: 'Balayages', classe: 'sa-num', rendu: (l) => fmt.nombre(l.balayages) }
            ], lignes: bdd.index_peu_utilises || [], vide: 'Aucun'
          })}
          <div class="cc-source">${esc(inter.index_peu_utilises || '')}</div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Requêtes longues en cours</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'duree_s', titre: 'Durée', classe: 'sa-num', rendu: (l) => `${esc(l.duree_s)} s` },
              { cle: 'state', titre: 'État' },
              { cle: 'requete', titre: 'Requête', classe: 'sa-mono' }
            ], lignes: bdd.requetes_en_cours_longues || [],
            vide: 'Aucune requête ne dépasse 3 secondes actuellement'
          })}
        </section>

        <div class="cc-source">
          Sources — API : ${esc((d.sources || {}).api || '')}<br>
          Base : ${esc((d.sources || {}).base || '')}<br>
          ${esc(inter.latences || '')}
        </div>`;
    }
  });

  /* ======================================================================
     5. INCIDENTS
     ====================================================================== */

  SA.enregistrerVue('cc/incidents', {
    titre: 'Incidents',
    sousTitre: 'Un incident regroupe des symptômes sous une cause, avec sa chronologie.',

    async rendu(conteneur, params, segments) {
      if (segments && segments.length) return rendreFicheIncident(conteneur, segments[0]);

      const requete = { statut: params.statut || '', page: params.page || 1 };
      conteneur.innerHTML = ui.squelette(6);

      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `<button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="cc-inc-nouveau">Ouvrir un incident</button>`;
      }

      const d = await SA.api(SA.url('/super-admin/control-center/incidents', requete));

      conteneur.innerHTML = `
        <div class="cc-filtres">
          <label class="cc-filtre"><span>Statut</span>
            <select class="sa-champ" id="cc-inc-statut">
              <option value="">Tous</option>
              ${['ouvert', 'investigation', 'identifie', 'surveille', 'resolu', 'clos'].map((s) =>
                `<option value="${s}"${requete.statut === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select></label>
        </div>
        ${ui.tableau({
          colonnes: [
            { cle: 'code', titre: 'Code', classe: 'sa-mono' },
            { cle: 'titre', titre: 'Titre' },
            { cle: 'severite', titre: 'Sévérité', rendu: (l) => ui.badge(l.severite, SA.ui.tonStatut(l.severite)) },
            { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) },
            { cle: 'debut', titre: 'Début', rendu: (l) => esc(fmt.dateHeure(l.debut)) },
            { cle: 'ecoles_touchees', titre: 'Écoles', classe: 'sa-num', rendu: (l) => fmt.nombre(l.ecoles_touchees) },
            { cle: 'evenements', titre: 'Événements', classe: 'sa-num', rendu: (l) => fmt.nombre(l.evenements) }
          ], lignes: d.donnees, cliquable: true, vide: 'Aucun incident'
        })}
        ${ui.pagination(d.pagination)}`;

      const sel = document.getElementById('cc-inc-statut');
      if (sel) sel.addEventListener('change', () => SA.naviguer('cc/incidents', { statut: sel.value }));

      conteneur.querySelectorAll('tr[data-id]').forEach((tr) => {
        tr.addEventListener('click', () => SA.naviguer(`cc/incidents/${tr.getAttribute('data-id')}`));
      });
      paginationSimple(conteneur, 'cc/incidents', requete);

      const btn = document.getElementById('cc-inc-nouveau');
      if (btn) {
        btn.addEventListener('click', () => {
          const modale = SA.modale({
            titre: 'Ouvrir un incident',
            contenu: `
              <label class="sa-connexion-champ"><span>Titre</span><input class="sa-champ" id="cc-ni-titre"></label>
              <label class="sa-connexion-champ"><span>Description</span><textarea class="sa-champ" id="cc-ni-desc" rows="3"></textarea></label>
              <label class="sa-connexion-champ"><span>Sévérité</span>
                <select class="sa-champ" id="cc-ni-sev">
                  <option value="moyenne">Moyenne</option><option value="haute">Haute</option>
                  <option value="critique">Critique</option><option value="basse">Basse</option>
                </select></label>`,
            actions: `<button class="sa-bouton sa-bouton-principal" data-role="ok">Ouvrir</button>`
          });
          modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
            try {
              const inc = await SA.api('/super-admin/control-center/incidents', {
                method: 'POST',
                body: JSON.stringify({
                  titre: document.getElementById('cc-ni-titre').value,
                  description: document.getElementById('cc-ni-desc').value,
                  severite: document.getElementById('cc-ni-sev').value
                })
              });
              modale.fermer();
              SA.naviguer(`cc/incidents/${inc.id}`);
            } catch (err) { SA.toast(err.message, 'danger'); }
          });
        });
      }
    }
  });

  async function rendreFicheIncident(conteneur, id) {
    {
      conteneur.innerHTML = ui.squelette(6);
      const d = await SA.api(`/super-admin/control-center/incidents/${id}`);
      const i = d.incident;

      conteneur.innerHTML = `
        <section class="sa-panneau">
          <h3 class="sa-section-titre">${esc(i.code)} — ${esc(i.titre)}</h3>
          <dl>
            <div class="cc-champ"><dt>Sévérité</dt><dd>${ui.badge(i.severite, SA.ui.tonStatut(i.severite))}</dd></div>
            <div class="cc-champ"><dt>Statut</dt><dd>${ui.badgeStatut(i.statut)}</dd></div>
            <div class="cc-champ"><dt>Début</dt><dd>${esc(fmt.dateHeure(i.debut))}</dd></div>
            <div class="cc-champ"><dt>Fin</dt><dd>${i.fin ? esc(fmt.dateHeure(i.fin)) : 'en cours'}</dd></div>
            <div class="cc-champ"><dt>Écoles touchées</dt><dd>${esc(fmt.nombre(i.ecoles_touchees))}</dd></div>
            <div class="cc-champ"><dt>Cause probable</dt><dd>${esc(i.cause_probable || '—')}</dd></div>
          </dl>
          ${i.description ? `<p class="sa-texte">${esc(i.description)}</p>` : ''}
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Faire évoluer</h2>
          <div class="cc-filtres">
            <label class="cc-filtre"><span>Statut</span>
              <select class="sa-champ" id="cc-id-statut">
                ${['ouvert', 'investigation', 'identifie', 'surveille', 'resolu', 'clos'].map((s) =>
                  `<option value="${s}"${i.statut === s ? ' selected' : ''}>${s}</option>`).join('')}
              </select></label>
            <label class="cc-filtre cc-filtre-large"><span>Note de chronologie</span>
              <input class="sa-champ" id="cc-id-note" placeholder="ce qui vient d'être constaté ou fait"></label>
            <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="cc-id-maj">Enregistrer</button>
          </div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Chronologie</h2>
          <div class="cc-timeline">
            ${(d.timeline || []).map((t) => `
              <div class="cc-timeline-item type-${esc(t.type)}">
                <div class="cc-timeline-heure">${esc(fmt.dateHeure(t.horodatage))} ${t.auteur ? '· ' + esc(t.auteur) : ''}</div>
                <div class="cc-timeline-contenu">${esc(t.contenu)}</div>
              </div>`).join('') || ui.etatVide('Aucun événement', '')}
          </div>
        </section>

        ${(d.bugs || []).length ? `
          <section class="sa-section">
            <h2 class="sa-section-titre">Erreurs liées</h2>
            ${ui.tableau({
              colonnes: [
                { cle: 'message', titre: 'Erreur' },
                { cle: 'chemin', titre: 'Route', classe: 'sa-mono' },
                { cle: 'occurrences', titre: '×', classe: 'sa-num', rendu: (l) => fmt.nombre(l.occurrences) },
                { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badgeStatut(l.statut) }
              ], lignes: d.bugs, vide: ''
            })}
          </section>` : ''}`;

      const btn = document.getElementById('cc-id-maj');
      if (btn) {
        btn.addEventListener('click', async () => {
          try {
            await SA.api(`/super-admin/control-center/incidents/${i.id}`, {
              method: 'PATCH',
              body: JSON.stringify({
                statut: document.getElementById('cc-id-statut').value,
                note: document.getElementById('cc-id-note').value || null
              })
            });
            SA.toast('Incident mis à jour.', 'succes');
            SA.rafraichirVue();
          } catch (err) { SA.toast(err.message, 'danger'); }
        });
      }
    }
  }

  /* ======================================================================
     6. ALERTES
     ====================================================================== */

  SA.enregistrerVue('cc/alertes', {
    titre: 'Alertes',
    sousTitre: 'Regroupées par fenêtre : une même alerte ne part pas 237 fois.',

    async rendu(conteneur, params) {
      const requete = { statut: params.statut || '', niveau: params.niveau || '', page: params.page || 1 };
      conteneur.innerHTML = ui.squelette(6);
      const d = await SA.api(SA.url('/super-admin/control-center/alertes', requete));

      conteneur.innerHTML = `
        <div class="cc-filtres">
          <label class="cc-filtre"><span>Statut</span>
            <select class="sa-champ" id="cc-al-statut">
              <option value="">Tous</option>
              ${['nouvelle', 'notifiee', 'acquittee', 'close'].map((s) =>
                `<option value="${s}"${requete.statut === s ? ' selected' : ''}>${s}</option>`).join('')}
            </select></label>
          <label class="cc-filtre"><span>Niveau</span>
            <select class="sa-champ" id="cc-al-niveau">
              <option value="">Tous</option>
              ${['info', 'warning', 'high', 'critical'].map((n) =>
                `<option value="${n}"${requete.niveau === n ? ' selected' : ''}>${n}</option>`).join('')}
            </select></label>
        </div>

        ${ui.tableau({
          colonnes: [
            { cle: 'niveau', titre: 'Niveau', rendu: (l) => `<span class="cc-log-niveau ${l.niveau === 'critical' ? 'critical' : l.niveau === 'high' ? 'error' : l.niveau === 'warning' ? 'warning' : 'info'}">${esc(l.niveau)}</span>` },
            { cle: 'categorie', titre: 'Catégorie' },
            { cle: 'titre', titre: 'Alerte', rendu: (l) => `<div>${esc(l.titre)}</div><div class="sa-annexe">${esc(String(l.message).slice(0, 140))}</div>` },
            { cle: 'occurrences', titre: '×', classe: 'sa-num', rendu: (l) => fmt.nombre(l.occurrences) },
            { cle: 'canaux_envoyes', titre: 'Canaux', rendu: (l) => (l.canaux_envoyes || []).map((c) => ui.badge(c, 'neutre')).join(' ') || '<span class="sa-muet">aucun</span>' },
            { cle: 'created_at', titre: 'Quand', rendu: (l) => esc(fmt.relatif(l.created_at)) },
            { cle: 'statut', titre: '', rendu: (l) => l.statut === 'acquittee'
              ? ui.badge('acquittée', 'succes')
              : `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-acquitter="${esc(l.id)}">Acquitter</button>` }
          ], lignes: d.donnees, vide: 'Aucune alerte'
        })}
        ${ui.pagination(d.pagination)}
        <div class="cc-source">${esc(d.note || '')}</div>

        <section class="sa-section">
          <h2 class="sa-section-titre">Règles de notification</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'libelle', titre: 'Catégorie' },
              { cle: 'niveau_minimum', titre: 'Envoi à partir de', rendu: (l) => ui.badge(l.niveau_minimum, 'neutre') },
              { cle: 'canal_notification', titre: 'Notification', rendu: (l) => l.canal_notification ? '✓' : '—' },
              { cle: 'canal_email', titre: 'Email', rendu: (l) => l.canal_email ? '✓' : '—' },
              { cle: 'fenetre_minutes', titre: 'Regroupement', rendu: (l) => `${esc(l.fenetre_minutes)} min` },
              { cle: 'actif', titre: 'Actif', rendu: (l) => l.actif ? ui.badge('oui', 'succes') : ui.badge('non', 'neutre') }
            ], lignes: d.regles || [], vide: ''
          })}
          <div class="cc-source">
            Le canal « notification » est cet écran : les alertes internes ne partent
            jamais vers les tableaux de bord des écoles. Pour l'email, renseignez
            <span class="sa-mono">SUPER_ADMIN_EMAIL</span> ou les destinataires de la règle.
          </div>
        </section>`;

      ['statut', 'niveau'].forEach((n) => {
        const el = document.getElementById(`cc-al-${n}`);
        if (el) el.addEventListener('change', () =>
          SA.naviguer('cc/alertes', Object.assign({}, requete, { [n]: el.value, page: 1 })));
      });

      conteneur.querySelectorAll('[data-acquitter]').forEach((b) => {
        b.addEventListener('click', async (ev) => {
          ev.stopPropagation();
          try {
            await SA.api(`/super-admin/control-center/alertes/${b.getAttribute('data-acquitter')}/acquitter`,
              { method: 'POST' });
            SA.toast('Alerte acquittée.', 'succes');
            SA.rafraichirVue();
          } catch (err) { SA.toast(err.message, 'danger'); }
        });
      });
      paginationSimple(conteneur, 'cc/alertes', requete);
    }
  });

  /* ======================================================================
     7. VÉRIFICATIONS
     ====================================================================== */

  SA.enregistrerVue('cc/verifications', {
    titre: 'Vérifications de santé',
    sousTitre: "Elles EXÉCUTENT au lieu de mesurer : « est-ce que ça marche maintenant ? »",

    async rendu(conteneur) {
      const actions = document.getElementById('sa-entete-actions');
      if (actions) {
        actions.innerHTML = `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="cc-v-parcours">Lancer les parcours</button>
          <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="cc-v-lancer">Tout vérifier</button>`;
      }

      conteneur.innerHTML = ui.squelette(8, 40);
      const d = await SA.api('/super-admin/control-center/verifications');
      const cat = d.catalogue || {};
      const parCle = {};
      for (const r of d.derniers_resultats || []) parCle[r.cle] = r;

      conteneur.innerHTML = `
        <section class="sa-section">
          <h2 class="sa-section-titre">Contrôles ponctuels</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'statut', titre: '', rendu: (l) => {
                const r = parCle[l.cle];
                return `<span class="cc-voyant ${r ? esc(r.statut) : ''}"></span>`;
              } },
              { cle: 'libelle', titre: 'Vérification', rendu: (l) =>
                `<div>${esc(l.libelle)}</div><div class="sa-annexe sa-mono">${esc(l.cle)}</div>` },
              { cle: 'categorie', titre: 'Catégorie', rendu: (l) => ui.badge(l.categorie, 'neutre') },
              { cle: 'critique', titre: 'Critique', rendu: (l) => l.critique ? ui.badge('oui', 'danger') : '—' },
              { cle: 'message', titre: 'Dernier résultat', rendu: (l) => {
                const r = parCle[l.cle];
                return r ? esc(r.message) : '<span class="sa-muet">jamais exécutée</span>';
              } },
              { cle: 'execute_at', titre: 'Quand', rendu: (l) => {
                const r = parCle[l.cle];
                return r ? esc(fmt.relatif(r.execute_at)) : '—';
              } }
            ], lignes: cat.verifications || [], vide: 'Aucune vérification déclarée'
          })}
          <div class="cc-source">${esc(d.note || '')}</div>
        </section>

        <section class="sa-section">
          <h2 class="sa-section-titre">Parcours de bout en bout</h2>
          ${ui.tableau({
            colonnes: [
              { cle: 'statut', titre: '', rendu: (l) => {
                const r = parCle[l.cle];
                return `<span class="cc-voyant ${r ? esc(r.statut) : ''}"></span>`;
              } },
              { cle: 'libelle', titre: 'Parcours' },
              { cle: 'etapes', titre: 'Étapes', rendu: (l) => (l.etapes || []).map((e) => ui.badge(e, 'neutre')).join(' ') },
              { cle: 'message', titre: 'Dernier résultat', rendu: (l) => {
                const r = parCle[l.cle];
                return r ? esc(r.message) : '<span class="sa-muet">jamais exécuté</span>';
              } }
            ], lignes: cat.parcours || [], vide: 'Aucun parcours déclaré'
          })}
          <div class="cc-encart-fait">
            Chaque parcours s'exécute dans une transaction <strong>annulée sans
            condition</strong>, y compris en cas de succès : aucune donnée de test
            n'est jamais validée en base. C'est le seul mécanisme qui tienne quand
            un parcours plante au milieu.
          </div>
        </section>`;

      const btn = document.getElementById('cc-v-lancer');
      if (btn) {
        btn.addEventListener('click', async () => {
          btn.disabled = true; btn.textContent = 'Vérification…';
          try {
            const r = await SA.api('/super-admin/control-center/verifications/executer', { method: 'POST' });
            SA.toast(`${r.resume.ok} réussi(s) · ${r.resume.echec} en échec · ${r.resume.ignore} non applicable(s).`,
              r.resume.echec ? 'danger' : 'succes', 8000);
            SA.rafraichirVue();
          } catch (err) { SA.toast(err.message, 'danger'); btn.disabled = false; btn.textContent = 'Tout vérifier'; }
        });
      }

      const btnP = document.getElementById('cc-v-parcours');
      if (btnP) {
        btnP.addEventListener('click', async () => {
          const ok = await SA.confirmer({
            titre: 'Lancer les parcours synthétiques',
            message: "Ils créent une école, une classe et un élève de test, puis ANNULENT "
                   + "la transaction sans condition. Aucune donnée ne sera validée en base.",
            libelleValider: 'Lancer'
          });
          if (!ok) return;
          btnP.disabled = true; btnP.textContent = 'Exécution…';
          try {
            const r = await SA.api('/super-admin/control-center/verifications/parcours', { method: 'POST' });
            SA.toast(`${r.resume.ok} parcours réussi(s), ${r.resume.echec} en échec.`,
              r.resume.echec ? 'danger' : 'succes', 8000);
            SA.rafraichirVue();
          } catch (err) { SA.toast(err.message, 'danger'); btnP.disabled = false; btnP.textContent = 'Lancer les parcours'; }
        });
      }
    }
  });
})();

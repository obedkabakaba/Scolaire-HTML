/* ==========================================================================
   ARDOISE — KNOWLEDGE HUB
   --------------------------------------------------------------------------
   Plusieurs bases, un éditeur au centre, un historique à droite.

   L'INTERFACE DIT CE QUE LA CONNAISSANCE VAUT
   -------------------------------------------
   Une base de connaissance CONSEILLE le modèle ; elle ne remplace aucun
   contrôle serveur. L'écran l'affiche en tête de la hiérarchie des sources,
   pour que personne n'écrive « le Directeur peut enregistrer un paiement » en
   croyant que cela le lui permettra.

   LE PÉRIMÈTRE EST VISIBLE, PAS DEVINÉ
   ------------------------------------
   Chaque base montre quels assistants la reçoivent, et l'écran « Périmètre »
   répond à la question inverse : « que reçoit cet assistant, et que ne
   reçoit-il PAS — avec le motif de chaque exclusion ». Un cloisonnement qu'on
   ne peut pas constater est un cloisonnement qu'on ne peut pas maintenir.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, ui } = SA;
  const BASE = '/super-admin/ia';

  const TON_SENSIBILITE = {
    publique: 'succes', interne: 'info', technique: 'alerte', confidentielle: 'danger'
  };

  function diffHtml(d) {
    if (!d || !d.lignes) return '';
    return `<pre class="ia-diff">${d.lignes.map((l) => {
      const t = esc(l.ligne);
      if (l.type === 'ajoute') return `<span class="d-ajout">+${t}</span>`;
      if (l.type === 'retire') return `<span class="d-retrait">-${t}</span>`;
      return ` ${t}`;
    }).join('\n')}</pre>`;
  }

  /* ======================================================================
     1. HUB — bases à gauche, éditeur au centre
     ====================================================================== */

  SA.enregistrerVue('ia/connaissance', {
    titre: 'Knowledge Hub',
    sousTitre: "Ce que l'IA sait d'Ardoise. Versionné, cloisonné, restaurable.",

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(8);

      let d;
      try {
        d = await SA.api(`${BASE}/connaissance/bases`);
      } catch (err) {
        conteneur.innerHTML = ui.etatErreur(err.message);
        return;
      }

      const baseActive = (params && params.base) || (d.bases[0] && d.bases[0].code);

      const entete = document.getElementById('sa-entete-actions');
      if (entete) {
        entete.innerHTML = `
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="kb-perimetre">Périmètre</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="kb-export">Exporter</button>
          <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="kb-import">Importer</button>
          <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="kb-nouvelle-fiche">Nouvelle fiche</button>`;
      }

      conteneur.innerHTML = `
        <div class="kb-hub">
          <nav class="kb-bases">
            ${d.bases.map((b) => `
              <button class="kb-base ${b.code === baseActive ? 'actif' : ''}" data-base="${esc(b.code)}">
                <span class="kb-base-icone">${esc(b.icone || '📄')}</span>
                <span class="kb-base-nom">${esc(b.titre)}</span>
                <span title="${b.connectee_ia
                  ? (b.nb_fiches ? 'Connectée aux IA' : 'Connectée, en attente de fiches')
                  : 'Non connectée à une IA'}">${b.connectee_ia ? (b.nb_fiches ? '●' : '○') : '⚠'}</span>
                <span class="kb-base-compte">${b.nb_fiches}</span>
              </button>`).join('')}
            <button class="kb-base kb-base-ajout" id="kb-nouvelle-base">+ Nouvelle base</button>
          </nav>

          <section class="kb-centre" id="kb-centre">${ui.squelette(5)}</section>

          <aside class="kb-droite" id="kb-droite"></aside>
        </div>`;

      conteneur.querySelectorAll('[data-base]').forEach((b) => {
        b.addEventListener('click', () => {
          SA.majParams({ base: b.dataset.base });
          SA.rafraichirVue();
        });
      });

      const nouvelleBase = document.getElementById('kb-nouvelle-base');
      if (nouvelleBase) nouvelleBase.addEventListener('click', () => ouvrirNouvelleBase());

      const perimetre = document.getElementById('kb-perimetre');
      if (perimetre) perimetre.addEventListener('click', () => ouvrirPerimetre(d.usages));

      const exporter = document.getElementById('kb-export');
      if (exporter) exporter.addEventListener('click', () => ouvrirExport(baseActive));

      const importer = document.getElementById('kb-import');
      if (importer) importer.addEventListener('click', () => ouvrirImport());

      const nouvelleFiche = document.getElementById('kb-nouvelle-fiche');
      if (nouvelleFiche) {
        nouvelleFiche.addEventListener('click', () =>
          ouvrirEditeur(null, baseActive, d.bases));
      }

      await afficherBase(baseActive, d);
    }
  });

  async function afficherBase(code, d) {
    const centre = document.getElementById('kb-centre');
    const droite = document.getElementById('kb-droite');
    const base = d.bases.find((b) => b.code === code);
    if (!base) { centre.innerHTML = ui.etatVide('Base introuvable'); return; }

    let fiches;
    try {
      fiches = await SA.api(`${BASE}/connaissance/fiches?base=${encodeURIComponent(code)}`);
    } catch (err) {
      centre.innerHTML = ui.etatErreur(err.message);
      return;
    }

    centre.innerHTML = `
      <header class="kb-base-entete">
        <div>
          <h2>${esc(base.icone || '')} ${esc(base.titre)}</h2>
          <p class="sa-muet">${esc(base.description || '')}</p>
        </div>
        <div class="kb-base-badges">
          ${ui.badge(base.sensibilite, TON_SENSIBILITE[base.sensibilite])}
          ${ui.badge(base.connectee_ia
            ? (base.nb_fiches ? 'Connectée aux IA' : 'Connectée · base vide')
            : 'Non connectée', base.connectee_ia ? (base.nb_fiches ? 'succes' : 'info') : 'danger')}
          <span class="sa-muet">priorité ${base.priorite}</span>
        </div>
      </header>

      ${base.note_sensibilite ? `<div class="sa-bandeau ton-alerte">${esc(base.note_sensibilite)}</div>` : ''}
      ${(base.problemes_connexion || []).length ? `
        <div class="sa-bandeau ton-danger">
          ${base.problemes_connexion.map(esc).join(' ')} Ouvrez « Modifier le périmètre » pour resynchroniser.
        </div>` : ''}

      ${fiches.fiches.length ? `
        <ul class="kb-fiches">
          ${fiches.fiches.map((f) => `
            <li>
              <button class="kb-fiche" data-fiche="${esc(f.cle)}">
                <strong>${esc(f.titre)}</strong>
                <span class="sa-muet">
                  <code>${esc(f.cle)}</code> · version ${f.version} ·
                  ${esc(new Date(f.updated_at).toLocaleDateString('fr-FR'))}
                  ${f.prenom || f.nom ? ` · ${esc(`${f.prenom || ''} ${f.nom || ''}`.trim())}` : ''}
                </span>
              </button>
            </li>`).join('')}
        </ul>`
        : ui.etatVide('Aucune fiche dans cette base',
            "Créez-en une : l'IA répondra ce que fait vraiment Ardoise, au lieu de généralités.")}`;

    droite.innerHTML = `
      <div class="kb-panneau">
        <h4>Périmètre de cette base</h4>
        <p class="sa-muet">Assistants qui la reçoivent :</p>
        <div class="ia-puces">
          ${(base.usages_connectes || []).length
            ? base.usages_connectes.map((u) => `<span class="ia-puce">${esc(u)}</span>`).join('')
            : '<span class="sa-muet">aucun — cette base n\'est transmise à personne</span>'}
        </div>
        <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="kb-editer-base">
          Modifier le périmètre
        </button>
      </div>

      <div class="kb-panneau">
        <h4>Hiérarchie des sources</h4>
        <ol class="kb-hierarchie">
          ${d.hierarchie.map((h) => `
            <li class="${h.source === 'connaissance' ? 'actif' : ''}">
              <strong>${esc(h.libelle)}</strong>
              <span class="sa-muet">${esc(h.note)}</span>
            </li>`).join('')}
        </ol>
      </div>`;

    centre.querySelectorAll('[data-fiche]').forEach((b) => {
      b.addEventListener('click', () => ouvrirEditeur(b.dataset.fiche, code, d.bases));
    });
    const editerBase = document.getElementById('kb-editer-base');
    if (editerBase) editerBase.addEventListener('click', () => ouvrirEditionBase(base, d.usages));
  }

  /* ======================================================================
     2. ÉDITEUR (items 65, 66)
     ====================================================================== */

  async function ouvrirEditeur(cle, baseCode, bases) {
    let fiche = null;
    let versions = [];

    if (cle) {
      try {
        const r = await SA.api(`${BASE}/connaissance/fiches/${encodeURIComponent(cle)}`);
        fiche = r.fiche;
        versions = r.versions;
      } catch (err) { SA.toast(err.message, 'erreur'); return; }
    }

    const modale = SA.modale({
      titre: fiche ? fiche.titre : 'Nouvelle fiche',
      sousTitre: fiche
        ? `Version ${fiche.version} · la précédente reste restaurable`
        : "Écrivez en Markdown. L'IA utilisera cette version.",
      large: true,
      contenu: `
        <div class="kb-editeur">
          <div class="kb-editeur-champs">
            <label class="sa-connexion-champ"><span>Titre</span>
              <input type="text" class="sa-champ" id="kb-titre" value="${esc(fiche ? fiche.titre : '')}"></label>
            <label class="sa-connexion-champ"><span>Clé</span>
              <input type="text" class="sa-champ" id="kb-cle" value="${esc(cle || '')}"
                     ${cle ? 'readonly' : ''} placeholder="politique-paiements"></label>
            <label class="sa-connexion-champ"><span>Base</span>
              <select class="sa-champ" id="kb-base">
                ${bases.map((b) => `<option value="${esc(b.code)}"
                  ${b.code === (fiche ? fiche.base_code : baseCode) ? 'selected' : ''}>${esc(b.titre)}</option>`).join('')}
              </select></label>
            <label class="sa-connexion-champ"><span>Mots-clés (séparés par des virgules)</span>
              <input type="text" class="sa-champ" id="kb-mots"
                     value="${esc((fiche && fiche.mots_cles || []).join(', '))}"></label>
          </div>

          <textarea class="sa-champ kb-markdown" id="kb-contenu" rows="18"
            placeholder="# Politique des paiements&#10;&#10;Seuls le Comptable et …">${esc(fiche ? fiche.contenu : '')}</textarea>

          <label class="sa-connexion-champ"><span>Motif de la modification</span>
            <input type="text" class="sa-champ" id="kb-motif"
                   placeholder="Ce qui a changé, et pourquoi"></label>

          ${versions.length ? `
            <details class="kb-historique">
              <summary>Historique — ${versions.length} version(s)</summary>
              <ul>
                ${versions.map((v) => `
                  <li>
                    <span>v${v.version}</span>
                    <span class="sa-muet">${esc(new Date(v.created_at).toLocaleString('fr-FR'))}
                      ${v.prenom || v.nom ? `· ${esc(`${v.prenom || ''} ${v.nom || ''}`.trim())}` : ''}
                      ${v.origine !== 'humain' ? `· ${esc(v.origine)}` : ''}</span>
                    <span class="kb-motif">${esc(v.motif || '')}</span>
                    <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                            data-comparer="${v.version}">Comparer</button>
                    <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                            data-restaurer="${v.version}">Restaurer</button>
                  </li>`).join('')}
              </ul>
            </details>` : ''}
        </div>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok">ENREGISTRER</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());

    modale.querySelectorAll('[data-comparer]').forEach((b) => {
      b.addEventListener('click', async () => {
        try {
          const r = await SA.api(
            `${BASE}/connaissance/fiches/${encodeURIComponent(cle)}/versions/${b.dataset.comparer}`);
          SA.modale({
            titre: `Version ${b.dataset.comparer}`,
            sousTitre: r.version.motif || '',
            large: true,
            contenu: diffHtml(r.diff),
            actions: '<button class="sa-bouton sa-bouton-principal" data-role="fermer">Fermer</button>'
          }).querySelector('[data-role="fermer"]').addEventListener('click', function () {
            this.closest('.sa-voile').remove();
          });
        } catch (err) { SA.toast(err.message, 'erreur'); }
      });
    });

    modale.querySelectorAll('[data-restaurer]').forEach((b) => {
      b.addEventListener('click', async () => {
        const ok = await SA.confirmer({
          titre: `Restaurer la version ${b.dataset.restaurer} ?`,
          message: "La restauration crée une version supplémentaire : l'historique n'est pas "
            + "effacé, et la restauration est elle-même annulable."
        });
        if (!ok) return;
        try {
          const r = await SA.api(`${BASE}/connaissance/fiches/${encodeURIComponent(cle)}/restaurer`, {
            method: 'POST', body: JSON.stringify({ version: Number(b.dataset.restaurer) })
          });
          modale.fermer();
          SA.toast(r.message, 'succes', 8000);
          SA.rafraichirVue();
        } catch (err) { SA.toast(err.message, 'erreur'); }
      });
    });

    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      const cleFinale = modale.querySelector('#kb-cle').value.trim();
      const titre = modale.querySelector('#kb-titre').value.trim();
      const contenu = modale.querySelector('#kb-contenu').value;

      if (!cleFinale || !titre) {
        SA.toast('La clé et le titre sont obligatoires.', 'erreur');
        return;
      }

      try {
        const r = await SA.api(`${BASE}/connaissance/fiches/${encodeURIComponent(cleFinale)}`, {
          method: 'PUT',
          body: JSON.stringify({
            titre,
            contenu,
            base_code: modale.querySelector('#kb-base').value,
            mots_cles: modale.querySelector('#kb-mots').value
              .split(',').map((m) => m.trim()).filter(Boolean),
            motif: modale.querySelector('#kb-motif').value || null
          })
        });
        modale.fermer();
        SA.toast(r.message, 'succes');
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });
  }

  /* ======================================================================
     3. BASES — création et périmètre (item 69)
     ====================================================================== */

  function ouvrirNouvelleBase() {
    const modale = SA.modale({
      titre: 'Nouvelle base de connaissance',
      contenu: `
        <div class="ia-grille-formulaire">
          <label class="sa-connexion-champ"><span>Code</span>
            <input type="text" class="sa-champ" id="kb-n-code" placeholder="juridique"></label>
          <label class="sa-connexion-champ"><span>Titre</span>
            <input type="text" class="sa-champ" id="kb-n-titre" placeholder="Juridique"></label>
          <label class="sa-connexion-champ"><span>Icône</span>
            <input type="text" class="sa-champ" id="kb-n-icone" value="📄" maxlength="4"></label>
          <label class="sa-connexion-champ"><span>Sensibilité</span>
            <select class="sa-champ" id="kb-n-sens">
              <option value="publique">Publique — peut atteindre parents et WhatsApp</option>
              <option value="interne" selected>Interne — équipe et personnel d'école</option>
              <option value="technique">Technique — jamais au public</option>
              <option value="confidentielle">Confidentielle — jamais au public</option>
            </select></label>
        </div>
        <label class="sa-connexion-champ"><span>Description</span>
          <textarea class="sa-champ" id="kb-n-desc" rows="2"></textarea></label>
        <p class="sa-muet">
          À la création, cette base sera automatiquement connectée aux IA Super Admin,
          dont AI Studio. Elle ne sera jamais ouverte automatiquement aux écoles,
          parents, élèves ou à WhatsApp. Ajoutez ensuite au moins une fiche : une base
          vide est connectée, mais ne contient encore rien à apprendre.
        </p>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok">Créer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());
    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      try {
        await SA.api(`${BASE}/connaissance/bases`, {
          method: 'POST',
          body: JSON.stringify({
            code: modale.querySelector('#kb-n-code').value,
            titre: modale.querySelector('#kb-n-titre').value,
            icone: modale.querySelector('#kb-n-icone').value,
            sensibilite: modale.querySelector('#kb-n-sens').value,
            description: modale.querySelector('#kb-n-desc').value
          })
        });
        modale.fermer();
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });
  }

  function ouvrirEditionBase(base, usages) {
    const jamaisPublic = ['technique', 'confidentielle'].includes(base.sensibilite);

    const modale = SA.modale({
      titre: `Périmètre — ${base.titre}`,
      sousTitre: 'Quels assistants reçoivent cette base.',
      large: true,
      contenu: `
        ${jamaisPublic ? `
          <div class="sa-bandeau ton-danger">
            Base ${esc(base.sensibilite)} : les assistants destinés au public (parents,
            élèves, WhatsApp) sont refusés, et le serveur rejettera la tentative. Un parent
            ne doit jamais recevoir d'information technique interne.
          </div>` : ''}

        <label class="sa-connexion-champ"><span>Sensibilité</span>
          <select class="sa-champ" id="kb-e-sens">
            ${['publique', 'interne', 'technique', 'confidentielle'].map((s) => `
              <option value="${s}" ${s === base.sensibilite ? 'selected' : ''}>${s}</option>`).join('')}
          </select></label>

        <label class="sa-connexion-champ"><span>Priorité (0 à 100 — départage les bases à pertinence proche)</span>
          <input type="number" min="0" max="100" class="sa-champ" id="kb-e-prio" value="${base.priorite}"></label>

        <fieldset class="kb-perimetre">
          <legend>Assistants autorisés</legend>
          ${usages.map((u) => {
            const interdit = jamaisPublic && u.audience === 'public';
            const coche = (base.usages_autorises || []).includes(u.code);
            return `<label class="sa-case ${interdit ? 'desactive' : ''}">
              <input type="checkbox" data-usage="${esc(u.code)}" ${coche ? 'checked' : ''}
                     ${interdit ? 'disabled' : ''}>
              ${esc(u.libelle)}
              ${u.audience === 'public' ? '<span class="sa-muet">public</span>' : ''}
            </label>`;
          }).join('')}
        </fieldset>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok">Enregistrer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());
    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      const choisis = [...modale.querySelectorAll('[data-usage]')]
        .filter((c) => c.checked).map((c) => c.dataset.usage);
      try {
        await SA.api(`${BASE}/connaissance/bases/${base.code}`, {
          method: 'PATCH',
          body: JSON.stringify({
            usages_autorises: choisis,
            sensibilite: modale.querySelector('#kb-e-sens').value,
            priorite: Number(modale.querySelector('#kb-e-prio').value)
          })
        });
        modale.fermer();
        SA.toast('Périmètre enregistré.', 'succes');
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });
  }

  /* ======================================================================
     4. VÉRIFICATION DU PÉRIMÈTRE (item 98)
     ====================================================================== */

  function ouvrirPerimetre(usages) {
    const modale = SA.modale({
      titre: 'Que reçoit cet assistant ?',
      sousTitre: 'Et surtout : que ne reçoit-il pas, et pourquoi.',
      large: true,
      contenu: `
        <label class="sa-connexion-champ"><span>Assistant</span>
          <select class="sa-champ" id="kb-p-usage">
            ${usages.map((u) => `<option value="${esc(u.code)}">${esc(u.libelle)}
              ${u.audience === 'public' ? '(public)' : ''}</option>`).join('')}
          </select></label>
        <div id="kb-p-resultat"></div>`,
      actions: '<button class="sa-bouton sa-bouton-principal" data-role="fermer">Fermer</button>'
    });

    modale.querySelector('[data-role="fermer"]').addEventListener('click', () => modale.fermer());
    const select = modale.querySelector('#kb-p-usage');
    const zone = modale.querySelector('#kb-p-resultat');

    async function charger() {
      zone.innerHTML = ui.squelette(3, 30);
      try {
        const r = await SA.api(`${BASE}/connaissance/perimetre?usage=${encodeURIComponent(select.value)}`);
        zone.innerHTML = `
          <p class="sa-muet">Audience : <strong>${esc(r.audience || '—')}</strong></p>

          <h4>Bases reçues</h4>
          ${r.bases_recues.length ? `
            <ul class="kb-liste-perimetre">
              ${r.bases_recues.map((b) => `<li>
                <strong>${esc(b.titre)}</strong>
                ${ui.badge(b.sensibilite, TON_SENSIBILITE[b.sensibilite])}
                <span class="sa-muet">priorité ${b.priorite}</span>
              </li>`).join('')}
            </ul>` : '<p class="sa-muet">Aucune.</p>'}

          <h4>Bases écartées</h4>
          <ul class="kb-liste-perimetre ecartees">
            ${r.bases_ecartees.map((e) => `<li>
              <code>${esc(e.base)}</code>
              <span class="sa-muet">${esc(e.motif)}</span>
            </li>`).join('')}
          </ul>

          <div class="sa-bandeau ton-info">${esc(r.regle)}</div>`;
      } catch (err) {
        zone.innerHTML = ui.etatErreur(err.message);
      }
    }

    select.addEventListener('change', charger);
    charger();
  }

  /* ======================================================================
     5. EXPORT / IMPORT (item 99)
     ====================================================================== */

  async function ouvrirExport(baseCode) {
    try {
      const d = await SA.api(`${BASE}/connaissance/export${baseCode ? `?base=${encodeURIComponent(baseCode)}` : ''}`);
      const texte = JSON.stringify(d, null, 2);
      const modale = SA.modale({
        titre: 'Export',
        sousTitre: `${d.nb_fiches} fiche(s) · base « ${d.base} »`,
        large: true,
        contenu: `<textarea class="sa-champ kb-markdown" rows="16" readonly id="kb-export-txt">${esc(texte)}</textarea>`,
        actions: `
          <button class="sa-bouton sa-bouton-secondaire" data-role="copier">Copier</button>
          <button class="sa-bouton sa-bouton-principal" data-role="fermer">Fermer</button>`
      });
      modale.querySelector('[data-role="fermer"]').addEventListener('click', () => modale.fermer());
      modale.querySelector('[data-role="copier"]').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(texte);
          SA.toast('Export copié.', 'succes');
        } catch (e) {
          modale.querySelector('#kb-export-txt').select();
          SA.toast('Copie refusée par le navigateur : le texte est sélectionné.', 'info');
        }
      });
    } catch (err) { SA.toast(err.message, 'erreur'); }
  }

  function ouvrirImport() {
    const modale = SA.modale({
      titre: 'Importer',
      sousTitre: "L'aperçu est obligatoire : rien n'est écrit avant que vous l'ayez lu.",
      large: true,
      contenu: `
        <label class="sa-connexion-champ"><span>JSON exporté</span>
          <textarea class="sa-champ kb-markdown" id="kb-i-json" rows="10"
            placeholder='{"fiches": [ … ]}'></textarea></label>
        <div id="kb-i-apercu"></div>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-secondaire" data-role="apercu">Voir les changements</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok" disabled>Importer</button>`
    });

    const zone = modale.querySelector('#kb-i-apercu');
    const boutonOk = modale.querySelector('[data-role="ok"]');
    let fiches = null;
    let attendus = null;

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());

    modale.querySelector('[data-role="apercu"]').addEventListener('click', async () => {
      let charge;
      try {
        charge = JSON.parse(modale.querySelector('#kb-i-json').value);
      } catch (e) {
        SA.toast('JSON illisible.', 'erreur');
        return;
      }
      fiches = Array.isArray(charge) ? charge : charge.fiches;
      if (!Array.isArray(fiches)) { SA.toast('Aucun tableau `fiches` trouvé.', 'erreur'); return; }

      try {
        const a = await SA.api(`${BASE}/connaissance/import/apercu`, {
          method: 'POST', body: JSON.stringify({ fiches })
        });
        attendus = a.creations.length + a.modifications.length;
        boutonOk.disabled = attendus === 0;

        zone.innerHTML = `
          <div class="sa-bandeau ton-info">${esc(a.resume)}</div>
          <p class="sa-muet">${esc(a.garantie)}</p>
          ${a.creations.length ? `
            <h4>Créations</h4>
            <ul class="kb-liste-perimetre">${a.creations.map((c) =>
              `<li><code>${esc(c.cle)}</code> ${esc(c.titre)}</li>`).join('')}</ul>` : ''}
          ${a.modifications.length ? `
            <h4>Modifications</h4>
            ${a.modifications.map((m) => `
              <details>
                <summary><code>${esc(m.cle)}</code> ${esc(m.titre)}
                  <span class="sa-muet">v${m.version_actuelle} · +${m.diff.ajouts} −${m.diff.retraits}</span>
                </summary>
                ${diffHtml(m.diff)}
              </details>`).join('')}` : ''}
          ${a.refusees.length ? `
            <h4>Refusées</h4>
            <ul class="kb-liste-perimetre ecartees">${a.refusees.map((r) =>
              `<li><code>${esc(r.cle || '?')}</code> <span class="sa-muet">${esc(r.motif)}</span></li>`).join('')}</ul>` : ''}`;
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });

    boutonOk.addEventListener('click', async () => {
      if (fiches === null || attendus === null) return;
      try {
        const r = await SA.api(`${BASE}/connaissance/import`, {
          method: 'POST',
          body: JSON.stringify({ fiches, changements_attendus: attendus })
        });
        modale.fermer();
        SA.toast(r.message, 'succes', 8000);
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });
  }

  /* ======================================================================
     6. PROPOSITIONS DE L'IA (items 67, 97)
     ====================================================================== */

  SA.enregistrerVue('ia/connaissance/propositions', {
    titre: 'Propositions de connaissance',
    sousTitre: "L'IA signale une contradiction ; elle ne choisit pas laquelle est vraie.",

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(6);
      let d;
      try {
        d = await SA.api(`${BASE}/connaissance/propositions`);
      } catch (err) {
        conteneur.innerHTML = ui.etatErreur(err.message);
        return;
      }

      conteneur.innerHTML = `
        <div class="sa-bandeau ton-info">${esc(d.rappel)}</div>
        ${d.propositions.length ? d.propositions.map((p) => `
          <article class="kb-proposition" data-id="${esc(p.id)}">
            <header>
              <h3>${esc(p.titre)}</h3>
              ${ui.badge(p.type, 'neutre')}
              ${p.base_code ? `<code>${esc(p.base_code)}</code>` : ''}
            </header>
            ${p.conflit ? `<div class="sa-bandeau ton-alerte">
              <strong>Connaissance potentiellement obsolète.</strong> ${esc(p.conflit)}
            </div>` : ''}
            ${p.justification ? `<p class="sa-texte">${esc(p.justification)}</p>` : ''}
            ${p.diff ? `<details><summary>Voir le diff</summary>${diffHtml(p.diff)}</details>` : ''}
            <footer>
              <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-refuser="${esc(p.id)}">REFUSER</button>
              <button class="sa-bouton sa-bouton-principal sa-bouton-petit" data-accepter="${esc(p.id)}">AUTORISER</button>
            </footer>
          </article>`).join('')
          : ui.etatVide('Aucune proposition en attente')}`;

      const decider = async (id, accepter) => {
        try {
          await SA.api(`${BASE}/connaissance/propositions/${id}/decider`, {
            method: 'POST', body: JSON.stringify({ accepter })
          });
          SA.toast(accepter ? 'Proposition appliquée.' : 'Proposition refusée.', 'succes');
          SA.rafraichirVue();
        } catch (err) { SA.toast(err.message, 'erreur'); }
      };

      conteneur.querySelectorAll('[data-accepter]').forEach((b) =>
        b.addEventListener('click', () => decider(b.dataset.accepter, true)));
      conteneur.querySelectorAll('[data-refuser]').forEach((b) =>
        b.addEventListener('click', () => decider(b.dataset.refuser, false)));
    }
  });
}());

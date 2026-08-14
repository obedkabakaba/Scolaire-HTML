/* ==========================================================================
   ARDOISE — AI STUDIO
   --------------------------------------------------------------------------
   Un espace de conversation, avec à droite quatre panneaux : Contexte, Outils,
   Actions, Quality Gate.

   CE QUE CET ÉCRAN NE FAIT JAMAIS
   -------------------------------
   Il ne pré-coche aucune autorisation. La carte d'autorisation présente
   REFUSER et AUTORISER UNE FOIS à égalité, sans bouton par défaut et sans
   raccourci clavier qui validerait. Un geste d'autorisation doit coûter un
   geste.

   Il n'annonce jamais qu'une modification est appliquée avant que le serveur
   ne l'ait confirmé, et il affiche le verdict du Quality Gate tel quel — y
   compris quand il contredit ce que l'IA vient d'écrire. « Ma correction
   fonctionne » n'est pas une information ; « Gate READY » en est une.

   Il affiche toujours le modèle qui a RÉELLEMENT répondu, pas celui qui était
   prévu : un repli qui passerait inaperçu ferait attribuer au mauvais moteur
   la qualité — ou la médiocrité — d'une réponse.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, ui } = SA;
  const BASE = '/super-admin/ia';

  const TON_DANGER = { LOW: 'succes', MEDIUM: 'info', HIGH: 'alerte', CRITICAL: 'danger' };

  function argent(v) {
    const n = Number(v || 0);
    return `${n.toFixed(n > 0 && n < 0.01 ? 5 : 4)} $`;
  }

  function heure(d) {
    return d ? new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '';
  }

  /**
   * Rend un texte de modèle. Pas de Markdown complet : on échappe tout, puis on
   * relève les blocs de code et les listes. Interpréter du Markdown produit par
   * un modèle, c'est accepter d'injecter du HTML qu'on n'a pas écrit.
   */
  function formaterReponse(texte) {
    const echappe = esc(String(texte || ''));
    return echappe
      .replace(/```(\w*)\n([\s\S]*?)```/g,
        (m, lang, code) => `<pre class="ia-code" data-langue="${esc(lang || '')}"><code>${code}</code></pre>`)
      .replace(/`([^`\n]+)`/g, '<code>$1</code>')
      .replace(/^(FAIT|HYPOTHÈSE|RECOMMANDATION)(\s*[—:-])/gm,
        '<strong class="ia-registre ia-registre-$1">$1</strong>$2')
      .replace(/\n/g, '<br>');
  }

  /* ======================================================================
     1. LISTE DES CONVERSATIONS
     ====================================================================== */

  /**
   * Répartiteur.
   *
   * Le routeur du noyau remonte les segments : `#/ia/studio/<id>` ne trouve pas
   * de vue à ce chemin, retire le dernier segment, et tombe sur `ia/studio`
   * avec `segments = ['<id>']`. On enregistre donc UNE vue qui aiguille, comme
   * le fait déjà `explorer/ecole` — enregistrer une clé littérale `:id` ne
   * serait jamais atteint.
   */
  SA.enregistrerVue('ia/studio', {
    titre: 'AI Studio',
    sousTitre: "Réservé au Super Admin. L'IA propose ; vous autorisez.",

    async rendu(conteneur, params, segments) {
      if (segments && segments[0]) return rendreConversation(conteneur, segments[0]);
      return rendreListe(conteneur);
    }
  });

  async function rendreListe(conteneur) {
    const actions = document.getElementById('sa-entete-actions');
    if (actions) {
      actions.innerHTML = `
        <button class="sa-bouton sa-bouton-principal sa-bouton-petit" id="ia-nouvelle">
          Nouvelle conversation
        </button>`;
    }

    conteneur.innerHTML = ui.squelette(6);
    let d;
    try {
      d = await SA.api(`${BASE}/studio/conversations`);
    } catch (err) {
      conteneur.innerHTML = ui.etatErreur(err.message);
      return;
    }

    const nouvelle = document.getElementById('ia-nouvelle');
    if (nouvelle) {
      nouvelle.addEventListener('click', async () => {
        try {
          const r = await SA.api(`${BASE}/studio/conversations`, {
            method: 'POST', body: JSON.stringify({ espace: 'ai_studio', usage_code: 'ai_studio' })
          });
          SA.naviguer(`ia/studio/${r.conversation.id}`);
        } catch (err) { SA.toast(err.message, 'erreur'); }
      });
    }

    conteneur.innerHTML = d.conversations.length ? `
      <div class="ia-conversations">
        ${d.conversations.map((c) => `
          <article class="ia-conv-carte" data-id="${esc(c.id)}">
            <button class="ia-conv-ouvrir" data-ouvrir="${esc(c.id)}">
              <strong>${esc(c.titre)}</strong>
              <span class="sa-muet">
                ${c.nb_messages} message(s) ·
                ${argent(c.cout_total_usd)}${c.cout_estime ? ' (estimation)' : ''} ·
                ${esc(new Date(c.updated_at).toLocaleString('fr-FR'))}
              </span>
              ${c.modele_choisi ? `<code>${esc(c.modele_choisi)}</code>` : ''}
            </button>
            <div class="ia-conv-actions">
              <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-renommer="${esc(c.id)}">Renommer</button>
              <button class="sa-bouton sa-bouton-danger sa-bouton-petit" data-supprimer="${esc(c.id)}">Supprimer</button>
            </div>
          </article>`).join('')}
      </div>`
      : ui.etatVide('Aucune conversation',
          "Ouvrez-en une pour analyser Ardoise, ou pour demander une correction.");

    conteneur.querySelectorAll('[data-ouvrir]').forEach((b) => {
      b.addEventListener('click', () => SA.naviguer(`ia/studio/${b.dataset.ouvrir}`));
    });

    conteneur.querySelectorAll('[data-renommer]').forEach((b) => {
      b.addEventListener('click', async () => {
        const conv = d.conversations.find((c) => c.id === b.dataset.renommer);
        const titre = await demanderTexte('Renommer la conversation', conv.titre);
        if (!titre) return;
        try {
          await SA.api(`${BASE}/studio/conversations/${conv.id}`, {
            method: 'PATCH', body: JSON.stringify({ titre })
          });
          SA.rafraichirVue();
        } catch (err) { SA.toast(err.message, 'erreur'); }
      });
    });

    conteneur.querySelectorAll('[data-supprimer]').forEach((b) => {
      b.addEventListener('click', async () => {
        const ok = await SA.confirmer({
          titre: 'Supprimer cette conversation ?',
          message: "Les actions proposées et le journal restent consultables : supprimer "
            + "une conversation n'efface pas la trace de ce qui a été modifié.",
          libelleValider: 'Supprimer', danger: true
        });
        if (!ok) return;
        try {
          await SA.api(`${BASE}/studio/conversations/${b.dataset.supprimer}`, { method: 'DELETE' });
          SA.rafraichirVue();
        } catch (err) { SA.toast(err.message, 'erreur'); }
      });
    });
  }

  function demanderTexte(titre, valeur) {
    return new Promise((resoudre) => {
      const modale = SA.modale({
        titre,
        contenu: `<label class="sa-connexion-champ"><span>Titre</span>
          <input type="text" class="sa-champ" id="ia-texte" value="${esc(valeur || '')}"></label>`,
        actions: `
          <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
          <button class="sa-bouton sa-bouton-principal" data-role="ok">Enregistrer</button>`
      });
      const champ = modale.querySelector('#ia-texte');
      const valider = () => { const v = champ.value.trim(); modale.fermer(); resoudre(v || null); };
      modale.querySelector('[data-role="ok"]').addEventListener('click', valider);
      modale.querySelector('[data-role="annuler"]')
        .addEventListener('click', () => { modale.fermer(); resoudre(null); });
      champ.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') valider(); });
      setTimeout(() => { champ.focus(); champ.select(); }, 30);
    });
  }

  /* ======================================================================
     2. UNE CONVERSATION
     ====================================================================== */

  async function rendreConversation(conteneur, id) {
    conteneur.innerHTML = ui.squelette(8);
    let d;
    try {
      d = await SA.api(`${BASE}/studio/conversations/${id}`);
    } catch (err) {
      conteneur.innerHTML = ui.etatErreur(err.message);
      return;
    }

    const entete = document.getElementById('sa-entete-actions');
    if (entete) {
      entete.innerHTML = `
        <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="ia-moteur">Moteur</button>
        <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="ia-externe">Exporter le contexte</button>
        <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="ia-retour">Toutes les conversations</button>`;
    }

    conteneur.innerHTML = `
      <div class="ia-studio">
        <section class="ia-studio-conversation">
          <div class="ia-moteur-barre" id="ia-moteur-barre">${barreMoteur(d.moteur_prevu)}</div>

          <div class="ia-fil" id="ia-fil">
            ${d.messages.length ? d.messages.map(bulle).join('')
              : `<div class="ia-accueil">
                   <h3>Que puis-je regarder ?</h3>
                   <p class="sa-texte">
                     Je consulte Ardoise par des outils nommés : santé, journaux, erreurs,
                     constats d'audit, règles métier, matrice des permissions, routes,
                     migrations, schéma de la base, documentation et Quality Gate.
                   </p>
                   <p class="sa-texte">
                     Je peux PROPOSER une modification, avec son diff, ses tests et ses
                     risques. Je ne peux pas l'appliquer : c'est vous qui autorisez, une
                     fois, pour ces fichiers, pour ce diff.
                   </p>
                   <div class="ia-suggestions">
                     ${[
                       "Le Directeur ne devrait pas pouvoir enregistrer ce paiement. Analyse le problème.",
                       'Quels écarts d\'audit sont les plus urgents, et pourquoi ?',
                       'Explique le verdict actuel du Quality Gate.',
                       'Quelle règle métier encadre la clôture d\'une période ?'
                     ].map((s) => `<button class="ia-suggestion">${esc(s)}</button>`).join('')}
                   </div>
                 </div>`}
          </div>

          <div class="ia-saisie">
            <textarea id="ia-question" rows="2"
              placeholder="Décrivez le problème — Entrée pour envoyer, Maj+Entrée pour un retour à la ligne"></textarea>
            <div class="ia-saisie-actions">
              <button class="sa-bouton sa-bouton-principal" id="ia-envoyer">Envoyer</button>
              <button class="sa-bouton sa-bouton-danger" id="ia-stop" hidden>Interrompre</button>
              <button class="sa-bouton sa-bouton-secondaire" id="ia-regenerer"
                      ${d.messages.length ? '' : 'disabled'}>Régénérer</button>
            </div>
          </div>
        </section>

        <aside class="ia-studio-panneau" id="ia-panneau">
          ${panneau(d)}
        </aside>
      </div>`;

    brancherConversation(conteneur, d, id);
  }

  function barreMoteur(m) {
    if (!m || !m.disponible) {
      return `<div class="ia-moteur indisponible">
        <strong>Moteur indisponible</strong>
        <span>${esc((m && m.message) || 'Aucun modèle configuré pour cet usage.')}</span>
        <a href="#/ia/routage">Configurer le routage</a>
      </div>`;
    }
    return `<div class="ia-moteur">
      <span><em>Provider</em> ${esc(m.provider)}</span>
      <span><em>Model</em> <code>${esc(m.model)}</code></span>
      <span><em>Profil</em> ${esc(m.profil || '—')}</span>
      <span><em>Mode</em> ${esc(m.mode)}</span>
      ${m.surcharge ? ui.badge('override pour cette conversation', 'info')
                    : ui.badge('modèle par défaut', 'neutre')}
      ${m.depuis_environnement ? ui.badge('configuration d\'environnement', 'alerte') : ''}
    </div>`;
  }

  function bulle(m) {
    if (m.role === 'user') {
      return `<div class="ia-message utilisateur">
        <div class="ia-message-corps">${esc(m.contenu)}</div>
        <div class="ia-message-meta">${esc(heure(m.created_at))}</div>
      </div>`;
    }

    const outils = (m.outils_appeles || []);
    const sources = (m.sources || []);

    return `<div class="ia-message assistant">
      <div class="ia-message-corps">${formaterReponse(m.contenu)}</div>
      <div class="ia-message-meta">
        <code>${esc(m.modele || '—')}</code>
        ${m.fournisseur_code ? `<span>${esc(m.fournisseur_code)}</span>` : ''}
        <span>${argent(m.cout_usd)}${m.estimation ? ' · ESTIMATION' : ' · mesuré'}</span>
        ${m.duree_ms ? `<span>${Math.round(m.duree_ms / 100) / 10} s</span>` : ''}
        ${outils.length ? `<span>${outils.length} outil(s)</span>` : ''}
        ${sources.length ? `<button class="ia-lien-sources" data-sources='${esc(JSON.stringify(sources))}'>
            ${sources.length} source(s)</button>` : ''}
      </div>
    </div>`;
  }

  /* ---------- Panneau latéral (item 90) ---------- */

  function panneau(d) {
    const actions = d.actions || [];
    const autorisees = actions.filter((a) => ['autorisee', 'appliquee'].includes(a.statut)).length;
    const derniereExec = actions.map((a) => a.quality_gate_statut).filter(Boolean).pop();

    return `
      <div class="ia-panneau-bloc">
        <h4>Contexte</h4>
        <dl class="ia-panneau-liste">
          <div><dt>Messages</dt><dd>${d.conversation.nb_messages}</dd></div>
          <div><dt>Coût</dt><dd>${argent(d.conversation.cout_total_usd)}
            ${d.conversation.cout_estime ? '<span class="sa-muet">estimation</span>' : ''}</dd></div>
          <div><dt>Espace</dt><dd>${esc(d.conversation.espace)}</dd></div>
        </dl>
      </div>

      <div class="ia-panneau-bloc">
        <h4>Outils</h4>
        <p class="sa-muet">
          Le modèle n'a ni shell ni accès direct à PostgreSQL. Il demande l'exécution
          d'outils nommés, que le serveur exécute avec le périmètre qu'il décide.
        </p>
        <div id="ia-outils-derniers"></div>
      </div>

      <div class="ia-panneau-bloc">
        <h4>Actions <span class="ia-compteur">${actions.length}</span></h4>
        ${actions.length ? `
          <ol class="ia-actions-liste">
            ${actions.map((a, i) => `
              <li class="ia-action ${esc(a.statut)}">
                <button class="ia-action-ouvrir" data-action-id="${esc(a.id)}">
                  <span class="ia-action-rang">${i + 1}.</span>
                  <span class="ia-action-titre">${esc(a.titre)}</span>
                  ${ui.badge(a.niveau_danger, TON_DANGER[a.niveau_danger])}
                  ${ui.badgeStatut(a.statut)}
                </button>
                ${a.branche ? `<div class="ia-action-suite">
                  <code>${esc(a.branche)}</code>
                  ${a.commit_sha ? `<code>${esc(String(a.commit_sha).slice(0, 8))}</code>` : ''}
                </div>` : ''}
              </li>`).join('')}
          </ol>
          <p class="ia-panneau-resume">Autorisations : ${autorisees}/${actions.length}</p>`
          : '<p class="sa-muet">Aucune action proposée.</p>'}
      </div>

      <div class="ia-panneau-bloc">
        <h4>Quality Gate</h4>
        ${derniereExec
          ? `<p class="ia-gate ia-gate-${esc(derniereExec)}">${esc(derniereExec)}</p>`
          : '<p class="sa-muet">non lancé</p>'}
        <p class="sa-muet">
          Le Gate est la preuve. Une correction n'est validée que par un verdict READY —
          jamais parce que l'IA affirme qu'elle fonctionne.
        </p>
      </div>`;
  }

  /* ---------- Interactions ---------- */

  function brancherConversation(conteneur, d, id) {
    const fil = conteneur.querySelector('#ia-fil');
    const champ = conteneur.querySelector('#ia-question');
    const envoyer = conteneur.querySelector('#ia-envoyer');
    const stop = conteneur.querySelector('#ia-stop');
    const regenerer = conteneur.querySelector('#ia-regenerer');

    const retour = document.getElementById('ia-retour');
    if (retour) retour.addEventListener('click', () => SA.naviguer('ia/studio'));

    const moteur = document.getElementById('ia-moteur');
    if (moteur) moteur.addEventListener('click', () => ouvrirChoixMoteur(d));

    const externe = document.getElementById('ia-externe');
    if (externe) externe.addEventListener('click', () => ouvrirContexteExterne(id));

    conteneur.querySelectorAll('.ia-suggestion').forEach((b) => {
      b.addEventListener('click', () => { champ.value = b.textContent.trim(); poser(); });
    });

    conteneur.querySelectorAll('[data-sources]').forEach((b) => {
      b.addEventListener('click', () => {
        const sources = JSON.parse(b.dataset.sources);
        SA.modale({
          titre: "Pourquoi l'IA dit cela",
          sousTitre: 'Les passages de connaissance transmis pour cette réponse.',
          contenu: `<ul class="ia-sources">
            ${sources.map((s) => `<li>
              <strong>${esc(s.titre)}</strong>
              <span class="sa-muet">base ${esc(s.base)} · clé ${esc(s.cle)} · version ${s.version}</span>
            </li>`).join('')}
          </ul>`,
          actions: '<button class="sa-bouton sa-bouton-principal" data-role="fermer">Fermer</button>'
        }).querySelector('[data-role="fermer"]').addEventListener('click', function () {
          this.closest('.sa-voile').remove();
        });
      });
    });

    conteneur.querySelectorAll('[data-action-id]').forEach((b) => {
      b.addEventListener('click', () => ouvrirCarteAutorisation(b.dataset.actionId));
    });

    champ.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); poser(); }
    });
    envoyer.addEventListener('click', poser);
    stop.addEventListener('click', async () => {
      try { await SA.api(`${BASE}/studio/conversations/${id}/interrompre`, { method: 'POST' }); }
      catch (err) { SA.toast(err.message, 'erreur'); }
    });
    regenerer.addEventListener('click', () => poser(null, true));

    async function poser(texteForce, estRegeneration) {
      const question = estRegeneration ? null : String(texteForce || champ.value).trim();
      if (!estRegeneration && !question) return;

      const accueil = fil.querySelector('.ia-accueil');
      if (accueil) accueil.remove();

      if (!estRegeneration) {
        champ.value = '';
        fil.insertAdjacentHTML('beforeend', bulle({ role: 'user', contenu: question, created_at: new Date() }));
      }

      const attente = document.createElement('div');
      attente.className = 'ia-message assistant';
      attente.innerHTML = '<div class="ia-message-corps"><span class="ia-reflexion"><span></span><span></span><span></span></span></div>';
      fil.appendChild(attente);
      fil.scrollTop = fil.scrollHeight;

      envoyer.disabled = true;
      regenerer.disabled = true;
      champ.disabled = true;
      stop.hidden = false;

      try {
        const chemin = estRegeneration
          ? `${BASE}/studio/conversations/${id}/regenerer`
          : `${BASE}/studio/conversations/${id}/messages`;
        const r = await SA.api(chemin, {
          method: 'POST',
          body: JSON.stringify(estRegeneration ? {} : { message: question })
        });

        attente.remove();
        fil.insertAdjacentHTML('beforeend', bulle({
          role: 'assistant',
          contenu: r.message.contenu,
          modele: r.moteur.model,
          fournisseur_code: r.moteur.provider,
          cout_usd: r.cout.usd,
          estimation: r.cout.estimation,
          duree_ms: r.message.duree_ms,
          outils_appeles: r.outils_appeles,
          sources: r.sources,
          created_at: r.message.created_at
        }));
        fil.scrollTop = fil.scrollHeight;

        if (r.moteur.replis && r.moteur.replis.length) {
          SA.toast(`Repli déclenché : ${r.moteur.replis.join(' ; ')}. `
            + `C'est ${r.moteur.model} qui a répondu.`, 'alerte', 10000);
        }
        if (r.actions_proposees && r.actions_proposees.length) {
          SA.toast(`${r.actions_proposees.length} action(s) proposée(s) — elles attendent `
            + `votre autorisation.`, 'info', 8000);
        }

        // Le panneau reflète l'état réel après chaque tour.
        const frais = await SA.api(`${BASE}/studio/conversations/${id}`);
        document.getElementById('ia-panneau').innerHTML = panneau(frais);
        document.getElementById('ia-moteur-barre').innerHTML = barreMoteur(frais.moteur_prevu);
        document.querySelectorAll('[data-action-id]').forEach((b) => {
          b.addEventListener('click', () => ouvrirCarteAutorisation(b.dataset.actionId));
        });

        const boiteOutils = document.getElementById('ia-outils-derniers');
        if (boiteOutils) {
          boiteOutils.innerHTML = (r.outils_appeles || []).length
            ? `<ul class="ia-outils">${r.outils_appeles.map((o) =>
                `<li><code>${esc(o.nom)}</code></li>`).join('')}</ul>`
            : '<p class="sa-muet">Aucun outil appelé pour ce message.</p>';
        }
      } catch (err) {
        attente.remove();
        if (err.status === 499) {
          fil.insertAdjacentHTML('beforeend',
            '<div class="ia-message systeme">Génération interrompue.</div>');
        } else {
          fil.insertAdjacentHTML('beforeend',
            `<div class="ia-message erreur">${esc(err.message)}</div>`);
        }
      } finally {
        envoyer.disabled = false;
        regenerer.disabled = false;
        champ.disabled = false;
        stop.hidden = true;
        champ.focus();
      }
    }
  }

  /* ---------- Choix du moteur (item 73) ---------- */

  async function ouvrirChoixMoteur(d) {
    let routage;
    try {
      routage = await SA.api(`${BASE}/routage`);
    } catch (err) { SA.toast(err.message, 'erreur'); return; }

    const m = d.moteur_prevu || {};
    const modale = SA.modale({
      titre: 'Moteur de cette conversation',
      sousTitre: 'Le changement prend effet au prochain message.',
      large: true,
      contenu: `
        <div class="sa-bandeau ton-info">
          Sans surcharge, la conversation suit le routage par défaut de l'usage
          « AI Studio ». Avec surcharge, elle s'en écarte — pour elle seule.
        </div>
        <dl class="ia-panneau-liste">
          <div><dt>Provider</dt><dd>${esc(m.provider || '—')}</dd></div>
          <div><dt>Model</dt><dd><code>${esc(m.model || '—')}</code></dd></div>
          <div><dt>Profil</dt><dd>${esc(m.profil || '—')}</dd></div>
          <div><dt>Mode</dt><dd>${esc(m.mode || '—')}</dd></div>
        </dl>

        <label class="sa-connexion-champ"><span>Profil</span>
          <select class="sa-champ" id="ia-c-profil">
            <option value="">Utiliser le profil par défaut de l'usage</option>
            ${routage.profils.map((p) => `<option value="${esc(p.code)}"
              ${p.code === d.conversation.profil_code ? 'selected' : ''}>${esc(p.code)} — ${esc(p.libelle)}</option>`).join('')}
          </select></label>

        <label class="sa-connexion-champ"><span>Modèle (override pour cette conversation)</span>
          <select class="sa-champ" id="ia-c-modele">
            <option value="">Utiliser le modèle par défaut</option>
            ${routage.modeles.map((x) => `<option value="${esc(x.id)}"
              ${x.id === d.conversation.modele_id ? 'selected' : ''}>${esc(x.fournisseur)} · ${esc(x.nom)}</option>`).join('')}
          </select></label>

        <label class="sa-connexion-champ"><span>Niveau de raisonnement</span>
          <select class="sa-champ" id="ia-c-raison">
            ${['', 'aucun', 'faible', 'moyen', 'eleve'].map((n) => `<option value="${n}"
              ${n === (d.conversation.niveau_raisonnement || '') ? 'selected' : ''}>${n || 'défaut du modèle'}</option>`).join('')}
          </select></label>
        ${m.supporte_raisonnement === false
          ? '<p class="sa-muet">Le modèle actuel ne déclare pas de mode raisonnement : ce réglage sera ignoré.</p>'
          : ''}`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-principal" data-role="ok">Appliquer</button>`
    });

    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());
    modale.querySelector('[data-role="ok"]').addEventListener('click', async () => {
      try {
        await SA.api(`${BASE}/studio/conversations/${d.conversation.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            profil_code: modale.querySelector('#ia-c-profil').value || null,
            modele_id: modale.querySelector('#ia-c-modele').value || null,
            niveau_raisonnement: modale.querySelector('#ia-c-raison').value || null
          })
        });
        modale.fermer();
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'erreur'); }
    });
  }

  /* ---------- Handoff externe (item 76) ---------- */

  async function ouvrirContexteExterne(id) {
    let r;
    try {
      r = await SA.api(`${BASE}/studio/conversations/${id}/contexte-externe`, {
        method: 'POST', body: JSON.stringify({})
      });
    } catch (err) { SA.toast(err.message, 'erreur'); return; }

    const modale = SA.modale({
      titre: 'Ouvrir chez un fournisseur',
      sousTitre: "Un contexte propre, à coller manuellement.",
      large: true,
      contenu: `
        <div class="sa-bandeau ton-alerte">${esc(r.avertissement)}</div>
        <textarea class="sa-champ ia-contexte-externe" id="ia-ctx" rows="14" readonly>${esc(r.contexte)}</textarea>
        <div class="ia-liens-externes">
          <a class="sa-bouton sa-bouton-secondaire" href="${esc(r.liens.chatgpt)}" target="_blank" rel="noopener">Ouvrir dans ChatGPT</a>
          <a class="sa-bouton sa-bouton-secondaire" href="${esc(r.liens.claude)}" target="_blank" rel="noopener">Ouvrir dans Claude</a>
        </div>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="copier">Copier le contexte</button>
        <button class="sa-bouton sa-bouton-principal" data-role="fermer">Fermer</button>`
    });

    modale.querySelector('[data-role="copier"]').addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(r.contexte);
        SA.toast('Contexte copié.', 'succes');
      } catch (e) {
        modale.querySelector('#ia-ctx').select();
        SA.toast('Copie automatique refusée par le navigateur : le texte est sélectionné.', 'info');
      }
    });
    modale.querySelector('[data-role="fermer"]').addEventListener('click', () => modale.fermer());
  }

  /* ======================================================================
     3. CARTE D'AUTORISATION (item 56)
     ====================================================================== */

  async function ouvrirCarteAutorisation(actionId) {
    let c;
    try {
      c = await SA.api(`${BASE}/studio/actions/${actionId}`);
    } catch (err) { SA.toast(err.message, 'erreur'); return; }

    const a = c.action;
    const liste = (titre, fichiers) => (fichiers.length ? `
      <div class="ia-carte-fichiers">
        <h4>${esc(titre)}</h4>
        <ul>${fichiers.map((f) => `<li><code>${esc(f)}</code></li>`).join('')}</ul>
      </div>` : '');

    const modale = SA.modale({
      titre: 'ACTION PROPOSÉE',
      sousTitre: a.titre,
      large: true,
      contenu: `
        <div class="ia-carte-autorisation">
          ${liste('Modifier', c.a_modifier)}
          ${liste('Créer', c.a_creer)}

          <dl class="ia-carte-champs">
            ${a.cause_supposee ? `<div><dt>Cause supposée</dt><dd>${esc(a.cause_supposee)}</dd></div>` : ''}
            <div><dt>Confiance</dt><dd>${ui.badge(a.confiance === 'fait' ? 'fait établi' : 'hypothèse',
              a.confiance === 'fait' ? 'succes' : 'alerte')}</dd></div>
            ${a.impact ? `<div><dt>Impact</dt><dd>${esc(a.impact)}</dd></div>` : ''}
            <div><dt>Risque</dt><dd>${ui.badge(a.niveau_danger, TON_DANGER[a.niveau_danger])}</dd></div>
            ${a.tests_prevus ? `<div><dt>Tests prévus</dt><dd>${esc(a.tests_prevus)}</dd></div>` : ''}
            ${a.risques ? `<div><dt>Risques</dt><dd>${esc(a.risques)}</dd></div>` : ''}
            ${a.rollback_prevu ? `<div><dt>Retour arrière</dt><dd>${esc(a.rollback_prevu)}</dd></div>` : ''}
            <div><dt>Quality Gate requis</dt><dd>${c.quality_gate_requis ? 'oui' : 'non'}</dd></div>
          </dl>

          ${c.motifs_risque && c.motifs_risque.length ? `
            <div class="ia-motifs-risque">
              <h4>Pourquoi ce niveau de risque</h4>
              <ul>${c.motifs_risque.map((m) => `<li>
                ${m.fichier ? `<code>${esc(m.fichier)}</code> — ` : ''}${esc(m.pourquoi)}
              </li>`).join('')}</ul>
            </div>` : ''}

          <div class="sa-bandeau ${c.autorisation === 'toujours_demander' ? 'ton-danger' : 'ton-info'}">
            ${esc(c.explication)}
            ${c.reauthentification_requise
              ? " Votre mot de passe vous sera redemandé." : ''}
          </div>

          ${c.diff_disponible
            ? '<button class="sa-bouton sa-bouton-secondaire" data-role="diff">Voir le diff</button>'
            : `<div class="sa-bandeau ton-alerte">
                 Aucun diff fourni : cette proposition est descriptive et ne peut pas être
                 appliquée telle quelle.
               </div>`}

          <p class="sa-muet">
            « Autoriser une fois » produit une autorisation limitée à cette action, à ces
            fichiers, à ce diff exact, valable ${c.duree_autorisation_minutes} minutes, et
            non réutilisable. Elle ne couvre NI la fusion NI le déploiement.
          </p>
        </div>`,
      actions: a.statut === 'proposee' ? `
        <button class="sa-bouton sa-bouton-secondaire" data-role="refuser">REFUSER</button>
        <button class="sa-bouton sa-bouton-danger" data-role="autoriser">AUTORISER UNE FOIS</button>`
        : `<button class="sa-bouton sa-bouton-principal" data-role="fermer">Fermer</button>`
    });

    const boutonDiff = modale.querySelector('[data-role="diff"]');
    if (boutonDiff) {
      boutonDiff.addEventListener('click', async () => {
        try {
          const r = await SA.api(`${BASE}/studio/actions/${actionId}/diff`);
          SA.modale({
            titre: 'Diff proposé',
            sousTitre: "C'est ce contenu exact que l'autorisation couvrira.",
            large: true,
            contenu: `<pre class="ia-diff">${colorerDiff(r.diff || '')}</pre>`,
            actions: '<button class="sa-bouton sa-bouton-principal" data-role="fermer">Fermer</button>'
          }).querySelector('[data-role="fermer"]').addEventListener('click', function () {
            this.closest('.sa-voile').remove();
          });
        } catch (err) { SA.toast(err.message, 'erreur'); }
      });
    }

    const fermer = modale.querySelector('[data-role="fermer"]');
    if (fermer) fermer.addEventListener('click', () => modale.fermer());

    const refuser = modale.querySelector('[data-role="refuser"]');
    if (refuser) {
      refuser.addEventListener('click', async () => {
        try {
          await SA.api(`${BASE}/studio/actions/${actionId}/refuser`, {
            method: 'POST', body: JSON.stringify({ motif: null })
          });
          modale.fermer();
          SA.toast('Action refusée.', 'info');
          SA.rafraichirVue();
        } catch (err) { SA.toast(err.message, 'erreur'); }
      });
    }

    const autoriser = modale.querySelector('[data-role="autoriser"]');
    if (autoriser) {
      autoriser.addEventListener('click', async () => {
        try {
          const r = await avecReauth(() => SA.api(`${BASE}/studio/actions/${actionId}/autoriser`, {
            method: 'POST', body: JSON.stringify({ portee: 'ecriture' })
          }));
          if (!r) return;
          modale.fermer();
          // Le jeton n'est jamais conservé : il sert immédiatement, puis
          // disparaît avec la fermeture de la modale.
          await ouvrirExecution(actionId, r.autorisation.jeton);
        } catch (err) { SA.toast(err.message, 'erreur'); }
      });
    }
  }

  function colorerDiff(diff) {
    return esc(diff).split('\n').map((l) => {
      if (l.startsWith('+++') || l.startsWith('---')) return `<span class="d-entete">${l}</span>`;
      if (l.startsWith('@@')) return `<span class="d-section">${l}</span>`;
      if (l.startsWith('+')) return `<span class="d-ajout">${l}</span>`;
      if (l.startsWith('-')) return `<span class="d-retrait">${l}</span>`;
      return l;
    }).join('\n');
  }

  async function avecReauth(action) {
    try {
      return await action();
    } catch (err) {
      if (!err || err.code !== 'REAUTHENTIFICATION_REQUISE') throw err;
      const mdp = await new Promise((resoudre) => {
        const m = SA.modale({
          titre: 'Confirmez votre mot de passe',
          sousTitre: 'Cette autorisation touche un fichier sensible.',
          contenu: `<label class="sa-connexion-champ"><span>Mot de passe</span>
            <input type="password" class="sa-champ" id="ia-r-mdp" autocomplete="current-password"></label>`,
          actions: `
            <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
            <button class="sa-bouton sa-bouton-principal" data-role="ok">Confirmer</button>`
        });
        const c = m.querySelector('#ia-r-mdp');
        const v = () => { const x = c.value; m.fermer(); resoudre(x || null); };
        m.querySelector('[data-role="ok"]').addEventListener('click', v);
        m.querySelector('[data-role="annuler"]').addEventListener('click', () => { m.fermer(); resoudre(null); });
        c.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') v(); });
        setTimeout(() => c.focus(), 30);
      });
      if (!mdp) return null;
      await SA.api('/super-admin/control-center/reauthentifier', {
        method: 'POST', body: JSON.stringify({ mot_de_passe: mdp })
      });
      return action();
    }
  }

  /* ======================================================================
     4. EXÉCUTION — branche, Quality Gate, PR (items 57, 58, 85)
     ====================================================================== */

  async function ouvrirExecution(actionId, jeton) {
    const modale = SA.modale({
      titre: 'Exécution',
      sousTitre: 'branche → commit → Quality Gate → pull request',
      large: true,
      contenu: '<div id="ia-exec-etapes">' + ui.squelette(4, 32) + '</div>',
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-role="fermer">Fermer</button>'
    });
    modale.querySelector('[data-role="fermer"]').addEventListener('click', () => {
      modale.fermer(); SA.rafraichirVue();
    });

    const zone = modale.querySelector('#ia-exec-etapes');
    const etape = (titre, etat, detail) => `
      <div class="ia-etape ${esc(etat)}">
        <span class="ia-etape-puce"></span>
        <div><strong>${esc(titre)}</strong>${detail ? `<p>${detail}</p>` : ''}</div>
      </div>`;

    let execution;
    try {
      const r = await SA.api(`${BASE}/studio/actions/${actionId}/appliquer`, {
        method: 'POST', body: JSON.stringify({ jeton })
      });

      if (!r.applique) {
        zone.innerHTML = etape('Application impossible', 'echec', esc(r.message))
          + `<div class="sa-bandeau ton-alerte">
               Le patch reste disponible : appliquez-le depuis un poste de développement.
               La branche prévue était <code>${esc(r.branche_prevue)}</code>.
             </div>`;
        return;
      }

      execution = r.execution_id;
      zone.innerHTML = r.etapes.map((e) =>
        etape(e.etape, e.ok ? 'ok' : 'echec', esc(e.detail || ''))).join('')
        + etape('Branche', 'ok', `<code>${esc(r.branche)}</code>`)
        + etape('Commit', 'ok', `<code>${esc(String(r.commit).slice(0, 12))}</code>`)
        + `<div class="sa-bandeau ton-info">${esc(r.prochaine_etape)}</div>`
        + '<div id="ia-gate-zone"></div>';
    } catch (err) {
      zone.innerHTML = etape('Échec', 'echec', esc(err.message))
        + '<div class="sa-bandeau ton-danger">L\'application a été annulée : la branche a été supprimée et l\'arbre de travail restauré.</div>';
      return;
    }

    const gateZone = modale.querySelector('#ia-gate-zone');
    gateZone.innerHTML = '<button class="sa-bouton sa-bouton-principal" id="ia-lancer-gate">Lancer le Quality Gate</button>';

    modale.querySelector('#ia-lancer-gate').addEventListener('click', async (ev) => {
      ev.currentTarget.disabled = true;
      gateZone.innerHTML = etape('Quality Gate', 'en-cours', 'Évaluation en cours…');
      try {
        const g = await SA.api(`${BASE}/studio/executions/${execution}/quality-gate`, { method: 'POST' });
        gateZone.innerHTML = `
          <div class="ia-gate-verdict ia-gate-${esc(g.verdict)}">${esc(g.verdict)}</div>
          <p class="sa-texte">${esc(g.message)}</p>
          ${g.reussi
            ? '<button class="sa-bouton sa-bouton-principal" id="ia-pr">Créer la pull request</button>'
            : `<div class="sa-bandeau ton-danger">
                 CORRECTION NON VALIDÉE. L'IA peut proposer une nouvelle correction ;
                 elle ne peut ni masquer les tests, ni déclarer ce verdict caduc.
               </div>`}`;

        const pr = modale.querySelector('#ia-pr');
        if (pr) {
          pr.addEventListener('click', async () => {
            try {
              const p = await SA.api(`${BASE}/studio/executions/${execution}/pull-request`, { method: 'POST' });
              gateZone.insertAdjacentHTML('beforeend', `
                <div class="ia-pr-corps">
                  <h4>${esc(p.titre)}</h4>
                  <pre>${esc(p.corps)}</pre>
                  <div class="sa-bandeau ton-alerte">${esc(p.prochaine_etape)}</div>
                </div>
                <div class="sa-bandeau ton-danger">
                  L'autorisation d'ÉCRITURE que vous avez donnée s'arrête ici. La mise en
                  production est une SECONDE décision, distincte : elle atteint les écoles.
                </div>
                <div id="ia-prod-zone">
                  <button class="sa-bouton sa-bouton-danger" id="ia-prod">
                    AUTORISER LA MISE EN PRODUCTION
                  </button>
                </div>`);
              pr.disabled = true;
              brancherMiseEnProduction(modale, actionId, execution);
            } catch (err) { SA.toast(err.message, 'erreur'); }
          });
        }
      } catch (err) {
        gateZone.innerHTML = etape('Quality Gate', 'echec', esc(err.message));
      }
    });
  }

  /**
   * La SECONDE autorisation (item 58).
   *
   * `POST /studio/executions/:id/mise-en-production` existait côté serveur —
   * ré-authentification exigée par la route, jeton de portée
   * `mise_en_production` exigé par le moteur — et aucun écran ne l'appelait.
   * La chaîne s'arrêtait donc à la pull request : le second verrou était écrit,
   * testé, et inatteignable.
   *
   * Autoriser l'écriture ne vaut pas autoriser la production. Ce sont deux
   * jetons distincts, demandés séparément, et le mot de passe est redemandé
   * pour le second : la seule action qui atteint les écoles ne s'obtient pas en
   * prolongeant un clic déjà donné.
   */
  function brancherMiseEnProduction(modale, actionId, execution) {
    const zone = modale.querySelector('#ia-prod-zone');
    const bouton = modale.querySelector('#ia-prod');
    if (!bouton) return;

    bouton.addEventListener('click', async () => {
      const confirme = await SA.confirmer({
        titre: 'Mettre en production ?',
        message: "Cette autorisation est distincte de celle qui a permis d'écrire le code. "
          + "Elle porte sur le déploiement, et ce qui est déployé atteint les écoles.",
        libelleValider: 'Autoriser la mise en production',
        danger: true
      });
      if (!confirme) return;

      bouton.disabled = true;
      try {
        // 1. Un jeton de portée `mise_en_production` — jamais celui de l'écriture.
        const a = await avecReauth(() => SA.api(`${BASE}/studio/actions/${actionId}/autoriser`, {
          method: 'POST', body: JSON.stringify({ portee: 'mise_en_production' })
        }));
        if (!a) { bouton.disabled = false; return; }

        // 2. La route exige en plus une ré-authentification fraîche.
        const r = await avecReauth(() => SA.api(
          `${BASE}/studio/executions/${execution}/mise-en-production`, {
            method: 'POST', body: JSON.stringify({ jeton: a.autorisation.jeton })
          }));
        if (!r) { bouton.disabled = false; return; }

        zone.innerHTML = `
          <div class="sa-bandeau ton-succes">
            Mise en production autorisée pour <code>${esc(r.branche)}</code>
            (<code>${esc(String(r.commit || '').slice(0, 12))}</code>).
            L'autorisation est consommée : elle ne resservira pas.
          </div>`;
        SA.toast('Mise en production autorisée.', 'succes');
      } catch (err) {
        bouton.disabled = false;
        SA.toast(err.message, 'erreur');
      }
    });
  }

  /* ======================================================================
     5. ACTIONS IA — vue globale et journal
     ====================================================================== */

  SA.enregistrerVue('ia/actions', {
    titre: 'Actions IA',
    sousTitre: "Toutes les propositions, leur autorisation et leur devenir.",

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(8);
      let d;
      try {
        d = await SA.api(`${BASE}/studio/actions`);
      } catch (err) {
        conteneur.innerHTML = ui.etatErreur(err.message);
        return;
      }

      conteneur.innerHTML = `
        <div class="sa-cartes-stats">
          ${Object.entries(d.resume).map(([statut, n]) =>
            ui.carteStat({ valeur: String(n), etiquette: statut.replace(/_/g, ' ') })).join('')}
        </div>
        ${ui.tableau({
          colonnes: [
            { titre: 'Action', cle: 'titre', rendu: (a) => `
              <div>
                <strong>${esc(a.titre)}</strong>
                <span class="sa-muet">${esc((a.fichiers || []).join(', '))}</span>
              </div>` },
            { titre: 'Domaine', cle: 'domaine', rendu: (a) => ui.badge(a.domaine, 'neutre') },
            { titre: 'Danger', cle: 'niveau_danger',
              rendu: (a) => ui.badge(a.niveau_danger, TON_DANGER[a.niveau_danger]) },
            { titre: 'Statut', cle: 'statut', rendu: (a) => ui.badgeStatut(a.statut) },
            { titre: 'Branche', cle: 'branche', rendu: (a) => (a.branche
              ? `<code>${esc(a.branche)}</code>` : '<span class="sa-muet">—</span>') },
            { titre: 'Gate', cle: 'quality_gate_statut', rendu: (a) => (a.quality_gate_statut
              ? ui.badge(a.quality_gate_statut,
                  a.quality_gate_statut === 'READY' ? 'succes'
                    : (a.quality_gate_statut === 'WARNING' ? 'alerte' : 'danger'))
              : '<span class="sa-muet">non lancé</span>') },
            { titre: 'Demandée le', cle: 'created_at',
              rendu: (a) => esc(new Date(a.created_at).toLocaleString('fr-FR')) },
            { titre: '', cle: 'actions', classe: 'sa-col-actions', rendu: (a) => `
              <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                      data-voir="${esc(a.id)}">Voir</button>
              ${a.execution_id && a.commit_sha
                ? `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit"
                           data-revert="${esc(a.execution_id)}">Revert</button>` : ''}` }
          ],
          lignes: d.actions,
          vide: "Aucune action proposée."
        })}`;

      conteneur.querySelectorAll('[data-voir]').forEach((b) => {
        b.addEventListener('click', () => ouvrirCarteAutorisation(b.dataset.voir));
      });
      conteneur.querySelectorAll('[data-revert]').forEach((b) => {
        b.addEventListener('click', async () => {
          const ok = await SA.confirmer({
            titre: 'Préparer un retour arrière ?',
            message: "Le revert devient une action comme une autre : il demandera une "
              + "autorisation et passera le Quality Gate.",
            libelleValider: 'Préparer le revert'
          });
          if (!ok) return;
          try {
            const r = await SA.api(`${BASE}/studio/executions/${b.dataset.revert}/revert`, {
              method: 'POST', body: JSON.stringify({})
            });
            SA.toast(r.message, 'succes', 8000);
            SA.rafraichirVue();
          } catch (err) { SA.toast(err.message, 'erreur'); }
        });
      });
    }
  });

  SA.enregistrerVue('ia/journal', {
    titre: "Journal des actions IA",
    sousTitre: "Qui a demandé, quel modèle, quels fichiers, qui a autorisé, quel verdict.",

    async rendu(conteneur, params) {
      conteneur.innerHTML = ui.squelette(10);

      const depuis = (params && params.depuis) || '';
      let d;
      try {
        d = await SA.api(`${BASE}/studio/journal${depuis ? `?depuis=${encodeURIComponent(depuis)}` : ''}`);
      } catch (err) {
        conteneur.innerHTML = ui.etatErreur(err.message);
        return;
      }

      const hier = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

      conteneur.innerHTML = `
        <div class="sa-filtres">
          <button class="sa-bouton sa-bouton-petit ${depuis ? 'sa-bouton-secondaire' : 'sa-bouton-principal'}"
                  data-depuis="">Tout</button>
          <button class="sa-bouton sa-bouton-petit ${depuis === hier ? 'sa-bouton-principal' : 'sa-bouton-secondaire'}"
                  data-depuis="${hier}">Depuis hier</button>
        </div>

        ${d.fichiers_touches.length ? `
          <section class="sa-section">
            <h3 class="sa-section-titre">Fichiers touchés sur la période</h3>
            <div class="ia-puces">
              ${d.fichiers_touches.map((f) => `<code class="ia-puce">${esc(f)}</code>`).join('')}
            </div>
          </section>` : ''}

        ${ui.tableau({
          colonnes: [
            { titre: 'Date', cle: 'horodatage',
              rendu: (e) => esc(new Date(e.horodatage).toLocaleString('fr-FR')) },
            { titre: 'Événement', cle: 'evenement', rendu: (e) => ui.badge(e.evenement, 'neutre') },
            { titre: 'Résumé', cle: 'resume' },
            { titre: 'Acteur', cle: 'acteur', rendu: (e) => (e.acteur_type === 'ia'
              ? ui.badge('IA', 'info')
              : (e.prenom || e.nom ? esc(`${e.prenom || ''} ${e.nom || ''}`.trim())
                                   : '<span class="sa-muet">système</span>')) },
            { titre: 'Modèle', cle: 'modele', rendu: (e) => (e.modele ? `<code>${esc(e.modele)}</code>` : null) },
            { titre: 'Fichiers', cle: 'fichiers',
              rendu: (e) => ((e.fichiers || []).length
                ? `<span title="${esc(e.fichiers.join('\n'))}">${e.fichiers.length}</span>` : null) },
            { titre: 'Branche', cle: 'branche', rendu: (e) => (e.branche ? `<code>${esc(e.branche)}</code>` : null) },
            { titre: 'Gate', cle: 'quality_gate_statut' }
          ],
          lignes: d.evenements,
          vide: "Aucune action IA enregistrée."
        })}

        <p class="sa-muet">${esc(d.note)}</p>`;

      conteneur.querySelectorAll('[data-depuis]').forEach((b) => {
        b.addEventListener('click', () => {
          SA.majParams({ depuis: b.dataset.depuis });
          SA.rafraichirVue();
        });
      });
    }
  });
}());

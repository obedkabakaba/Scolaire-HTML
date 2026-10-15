/* ==========================================================================
   Ardoise — Super Admin : MON COMPTE → SÉCURITÉ (double authentification)
   --------------------------------------------------------------------------
   Chaque Super Admin protège SON compte par un second facteur : un code à six
   chiffres produit par une application d'authentification (Google
   Authenticator, Microsoft Authenticator, Authy, 1Password, Aegis…).

   Le parcours suit trois états, et n'en montre qu'un à la fois :
     · inactive   → expliquer, puis « Configurer » ;
     · en cours   → clé à saisir dans l'application, puis premier code ;
     · active     → état, codes de secours restants, régénérer, désactiver.

   LE QR CODE EST CALCULÉ PAR LE SERVEUR, DESSINÉ ICI
   --------------------------------------------------
   Charger une bibliothèque de QR code depuis un CDN ferait passer le secret
   par du code tiers, sur la page la plus sensible de la plateforme. Le
   serveur renvoie donc la GRILLE des modules (lignes de « 0 » et de « 1 »),
   et cette page en tire un SVG à partir de nombres seulement : rien de servi
   n'est injecté tel quel. Sans grille (ancien serveur), la clé et le lien
   otpauth:// restent là. Le secret n'est affiché qu'une fois, pendant la
   configuration ; le serveur ne le renvoie plus jamais ensuite.
   ========================================================================== */

(function () {
  'use strict';

  const { esc, fmt, ui } = SA;

  function grouper(secret) {
    return String(secret || '').replace(/(.{4})/g, '$1 ').trim();
  }

  /** SVG du QR code à partir de la grille du serveur ; '' si elle est invalide. */
  function svgQr(qr) {
    const taille = qr && Number(qr.taille);
    if (!Number.isInteger(taille) || taille < 21 || taille > 177 || !Array.isArray(qr.lignes)
        || qr.lignes.length !== taille
        || !qr.lignes.every((l) => typeof l === 'string' && l.length === taille && /^[01]+$/.test(l))) {
      return '';
    }
    const marge = 4; // zone de silence exigée par la norme
    const cote = taille + 2 * marge;
    let trace = '';
    qr.lignes.forEach((ligne, y) => {
      for (let x = 0; x < taille; x++) {
        if (ligne[x] === '1') trace += `M${x + marge} ${y + marge}h1v1h-1z`;
      }
    });
    // Toujours sombre sur blanc, quel que soit le thème : c'est ce que lisent les appareils photo.
    return `<svg class="sa-mfa-qr" viewBox="0 0 ${cote} ${cote}" role="img"
                 aria-label="QR code à scanner avec l'application d'authentification"
                 shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
              <rect width="${cote}" height="${cote}" fill="#fff"/><path d="${trace}" fill="#000"/></svg>`;
  }

  function telechargerCodes(codes) {
    const contenu = [
      'Ardoise — codes de secours du Super Admin',
      `Générés le ${new Date().toLocaleString('fr-FR')}`,
      '',
      'Chaque code ne fonctionne qu\'une seule fois. Conservez ce fichier hors ligne.',
      '',
      ...codes
    ].join('\n');
    const lien = document.createElement('a');
    lien.href = URL.createObjectURL(new Blob([contenu], { type: 'text/plain;charset=utf-8' }));
    lien.download = 'ardoise-codes-de-secours.txt';
    document.body.appendChild(lien);
    lien.click();
    lien.remove();
    setTimeout(() => URL.revokeObjectURL(lien.href), 4000);
  }

  /** Les codes de secours ne s'affichent qu'une fois : on ne referme pas sans accord. */
  function montrerCodesSecours(codes, titre) {
    return new Promise((resoudre) => {
      const modale = SA.modale({
        titre: titre || 'Vos codes de secours',
        sousTitre: "Ils remplacent votre téléphone si vous le perdez. Ils ne seront plus jamais affichés.",
        contenu: `
          <div class="sa-codes-secours">${codes.map((c) => `<code>${esc(c)}</code>`).join('')}</div>
          <p class="sa-note" style="margin-top:14px">Chaque code ne sert qu'une fois. Rangez-les hors
            ligne (gestionnaire de mots de passe, papier sous clé) — pas dans un email.</p>
          <label class="sa-case-confirmation"><input type="checkbox" id="mfa-codes-ok">
            <span>J'ai conservé ces codes en lieu sûr.</span></label>`,
        actions: `
          <button class="sa-bouton sa-bouton-secondaire" data-role="copier">Copier</button>
          <button class="sa-bouton sa-bouton-secondaire" data-role="telecharger">Télécharger (.txt)</button>
          <button class="sa-bouton sa-bouton-principal" data-role="fini" disabled>Terminé</button>`
      });
      // Pas de fermeture accidentelle : ni clic sur le voile, ni croix, tant que non confirmé.
      const croix = modale.querySelector('.sa-fermer');
      if (croix) croix.style.visibility = 'hidden';
      modale.addEventListener('click', (ev) => { if (ev.target === modale) ev.stopImmediatePropagation(); }, true);
      const bloquerEchap = (ev) => { if (ev.key === 'Escape') ev.stopImmediatePropagation(); };
      document.addEventListener('keydown', bloquerEchap, true);

      const case_ = modale.querySelector('#mfa-codes-ok');
      const fini = modale.querySelector('[data-role="fini"]');
      case_.addEventListener('change', () => { fini.disabled = !case_.checked; });
      modale.querySelector('[data-role="copier"]').addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(codes.join('\n')); SA.toast('Codes copiés.', 'succes'); }
        catch (e) { SA.toast('Copie impossible : sélectionnez les codes à la main.', 'attention'); }
      });
      modale.querySelector('[data-role="telecharger"]').addEventListener('click', () => telechargerCodes(codes));
      fini.addEventListener('click', () => {
        document.removeEventListener('keydown', bloquerEchap, true);
        modale.fermer();
        resoudre();
      });
    });
  }

  /** Petite modale de saisie : code seul, ou mot de passe + code. */
  function demander({ titre, texte, motDePasse, libelle }) {
    return new Promise((resoudre) => {
      const modale = SA.modale({
        titre,
        contenu: `
          ${texte ? `<p class="sa-texte" style="margin-top:0">${esc(texte)}</p>` : ''}
          ${motDePasse ? `<label class="sa-champ-bloc"><span>Mot de passe</span>
            <input type="password" class="sa-champ" id="mfa-mdp" autocomplete="current-password"></label>` : ''}
          <label class="sa-champ-bloc"><span>Code de l'application (ou code de secours)</span>
            <input class="sa-champ sa-champ-code" id="mfa-code" autocomplete="one-time-code"
                   inputmode="text" maxlength="11" placeholder="123 456"></label>`,
        actions: `
          <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
          <button class="sa-bouton sa-bouton-principal" data-role="ok">${esc(libelle || 'Confirmer')}</button>`
      });
      const valider = () => {
        const code = modale.querySelector('#mfa-code').value.trim();
        const mdp = motDePasse ? modale.querySelector('#mfa-mdp').value : null;
        if (!code || (motDePasse && !mdp)) return;
        modale.fermer();
        resoudre({ code, motDePasse: mdp });
      };
      modale.querySelector('[data-role="ok"]').addEventListener('click', valider);
      modale.querySelector('[data-role="annuler"]').addEventListener('click', () => { modale.fermer(); resoudre(null); });
      modale.querySelectorAll('input').forEach((i) => i.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') valider(); }));
      setTimeout(() => (modale.querySelector('#mfa-mdp') || modale.querySelector('#mfa-code')).focus(), 30);
    });
  }

  /* Exposé au noyau : la ré-authentification des actions critiques demande le
     code quand le serveur l'exige (voir SA.api). */
  SA.demanderCodeMfa = function () {
    return demander({
      titre: 'Code de double authentification',
      texte: "Cette action critique exige aussi le code de votre application d'authentification.",
      libelle: 'Valider'
    }).then((r) => (r ? r.code : null));
  };

  SA.enregistrerVue('compte/securite', {
    titre: 'Sécurité du compte',
    sousTitre: 'Double authentification de votre compte Super Admin.',

    async rendu(conteneur) {
      let d;
      try {
        d = await SA.api('/super-admin/mfa');
      } catch (err) {
        if (err.statut === 404) {
          conteneur.innerHTML = ui.etatVide('Pas encore disponible sur ce serveur',
            "La version du serveur en ligne ne propose pas encore la double authentification. Elle apparaîtra ici après son déploiement.");
          return;
        }
        throw err;
      }

      if (!d.migration_appliquee) {
        conteneur.innerHTML = `<div class="sa-panneau sa-mfa">
          <h2 class="sa-section-titre">Installation incomplète</h2>
          <p class="sa-texte">La table de la double authentification n'existe pas encore dans la base.
            Appliquez la migration <code class="sa-mono">062-mfa-super-admin.sql</code>, puis revenez ici.
            En attendant, la connexion reste au mot de passe seul.</p></div>`;
        return;
      }

      if (d.active) return dessinerActive(conteneur, d);
      return dessinerInactive(conteneur, d);
    }
  });

  function dessinerInactive(conteneur, d) {
    conteneur.innerHTML = `
      <div class="sa-panneau sa-mfa">
        <div class="sa-mfa-entete">
          <span class="sa-mfa-etat ton-attention">${SA.ui.icone ? SA.ui.icone('alerte', 18) : ''} Non protégé</span>
          <h2 class="sa-section-titre">Activer la double authentification</h2>
        </div>
        <p class="sa-texte">Ce compte voit toutes les écoles. Aujourd'hui, son mot de passe suffit à l'ouvrir.
          Avec la double authentification, il faudra aussi le code à six chiffres affiché par votre
          téléphone : un mot de passe volé ne suffira plus.</p>
        <ol class="sa-mfa-etapes">
          <li>Installez une application d'authentification sur votre téléphone (Google Authenticator,
            Microsoft Authenticator, Authy, 1Password, Aegis…).</li>
          <li>Ajoutez-y Ardoise avec la clé qui va s'afficher.</li>
          <li>Saisissez le code affiché par l'application pour confirmer.</li>
        </ol>
        ${d.chiffrement_disponible ? '' : `<div class="sa-note" style="margin-bottom:14px">
          <strong>Indisponible sur ce serveur :</strong> aucune clé de chiffrement n'est configurée.
          Définissez <code class="sa-mono">MFA_CLE_CHIFFREMENT</code> (au moins 16 caractères) dans les
          variables d'environnement de l'hébergeur, puis redémarrez le service.</div>`}
        <button class="sa-bouton sa-bouton-principal" id="mfa-configurer" ${d.chiffrement_disponible ? '' : 'disabled'}>
          ${d.en_attente_confirmation ? 'Recommencer la configuration' : 'Configurer'}</button>
        <div id="mfa-configuration"></div>
      </div>`;

    const bouton = conteneur.querySelector('#mfa-configurer');
    bouton.addEventListener('click', async () => {
      bouton.disabled = true;
      try {
        const r = await SA.api('/super-admin/mfa/initialiser', { method: 'POST', body: '{}' });
        bouton.hidden = true;
        dessinerConfiguration(conteneur.querySelector('#mfa-configuration'), r);
      } catch (err) {
        SA.toast(err.message, 'danger');
        bouton.disabled = false;
      }
    });
  }

  function dessinerConfiguration(zone, r) {
    const qr = svgQr(r.qr);
    zone.innerHTML = `
      <div class="sa-mfa-config">
        ${qr ? `<div class="sa-mfa-qr-bloc">
          ${qr}
          <p class="sa-muet">Scannez ce code avec l'application d'authentification
            (« Ajouter un compte » → « Scanner un QR code »), ou saisissez la clé ci-dessous.</p>
        </div>` : ''}
        <div class="sa-champ-bloc"><span>${qr ? 'Ou saisissez la clé' : 'Clé de configuration'}</span>
          <div class="sa-mfa-cle">
            <code class="sa-mono" id="mfa-cle">${esc(grouper(r.secret))}</code>
            <button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="mfa-copier">Copier</button>
            <a class="sa-bouton sa-bouton-secondaire sa-bouton-petit" href="${esc(r.uri)}">Ouvrir dans l'application</a>
          </div>
          <p class="sa-muet" style="font-size:.78rem;margin:6px 0 0">Type « basée sur le temps », 6 chiffres,
            30 secondes. Le lien fonctionne sur le téléphone où l'application est installée.</p>
        </div>
        <label class="sa-champ-bloc"><span>Code affiché par l'application</span>
          <input class="sa-champ sa-champ-code" id="mfa-premier-code" autocomplete="one-time-code"
                 inputmode="numeric" maxlength="7" placeholder="123 456"></label>
        <button class="sa-bouton sa-bouton-principal" id="mfa-activer">Activer la double authentification</button>
      </div>`;

    zone.querySelector('#mfa-copier').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(r.secret); SA.toast('Clé copiée.', 'succes'); }
      catch (e) { SA.toast('Copie impossible : recopiez la clé à la main.', 'attention'); }
    });
    const champ = zone.querySelector('#mfa-premier-code');
    const activer = zone.querySelector('#mfa-activer');
    const envoyer = async () => {
      if (!champ.value.trim()) return champ.focus();
      activer.disabled = true;
      try {
        const res = await SA.api('/super-admin/mfa/activer', {
          method: 'POST', body: JSON.stringify({ code_mfa: champ.value.trim() })
        });
        await montrerCodesSecours(res.codes_secours, 'Double authentification activée');
        SA.toast('Double authentification activée. Elle sera demandée à la prochaine connexion.', 'succes', 8000);
        SA.rafraichirVue();
      } catch (err) {
        SA.toast(err.message, 'danger');
        activer.disabled = false;
        champ.select();
      }
    };
    activer.addEventListener('click', envoyer);
    champ.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') envoyer(); });
    setTimeout(() => champ.focus(), 30);
  }

  function dessinerActive(conteneur, d) {
    const peu = d.codes_secours_restants <= 3;
    conteneur.innerHTML = `
      <div class="sa-panneau sa-mfa">
        <div class="sa-mfa-entete">
          <span class="sa-mfa-etat ton-succes">${SA.ui.icone ? SA.ui.icone('valide', 18) : ''} Protégé</span>
          <h2 class="sa-section-titre">Double authentification active</h2>
        </div>
        <div class="sa-liste-infos">
          <div class="sa-ligne-info"><span>Activée</span><span>${esc(fmt.dateHeure(d.active_le))}</span></div>
          <div class="sa-ligne-info"><span>Dernière utilisation</span><span>${esc(fmt.relatif(d.derniere_utilisation))}</span></div>
          <div class="sa-ligne-info"><span>Codes de secours restants</span>
            <span>${ui.badge(`${d.codes_secours_restants} / 10`, peu ? 'attention' : 'succes')}</span></div>
        </div>
        ${peu ? '<p class="sa-note" style="margin-top:12px">Il vous reste peu de codes de secours : régénérez-en avant d\'en manquer.</p>' : ''}
        <div class="sa-mfa-actions">
          <button class="sa-bouton sa-bouton-secondaire" id="mfa-regenerer">Régénérer les codes de secours</button>
          <button class="sa-bouton sa-bouton-danger" id="mfa-desactiver">Désactiver</button>
        </div>
      </div>`;

    conteneur.querySelector('#mfa-regenerer').addEventListener('click', async () => {
      const r = await demander({ titre: 'Régénérer les codes de secours',
        texte: 'Les codes actuels cesseront de fonctionner.', libelle: 'Régénérer' });
      if (!r) return;
      try {
        const res = await SA.api('/super-admin/mfa/codes-secours', { method: 'POST', body: JSON.stringify({ code_mfa: r.code }) });
        await montrerCodesSecours(res.codes_secours, 'Nouveaux codes de secours');
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'danger'); }
    });

    conteneur.querySelector('#mfa-desactiver').addEventListener('click', async () => {
      const r = await demander({ titre: 'Désactiver la double authentification',
        texte: 'Le mot de passe suffira de nouveau à ouvrir ce compte. Les deux facteurs sont exigés pour le confirmer.',
        motDePasse: true, libelle: 'Désactiver' });
      if (!r) return;
      try {
        await SA.api('/super-admin/mfa/desactiver', { method: 'POST',
          body: JSON.stringify({ mot_de_passe: r.motDePasse, code_mfa: r.code }) });
        SA.toast('Double authentification désactivée.', 'attention', 8000);
        SA.rafraichirVue();
      } catch (err) { SA.toast(err.message, 'danger'); }
    });
  }
})();

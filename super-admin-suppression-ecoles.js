/* Ardoise — suppression définitive d'une école depuis le Super Admin.
   Chargé à la demande depuis la palette de commandes : aucune donnée sensible
   n'est embarquée, et la vraie autorisation reste imposée par le backend. */

export async function ouvrirSuppressionEcole() {
  if (!window.SA || !SA.session || !SA.session.connecte()) return;

  const esc = SA.esc;

  /**
   * Le serveur décide si la preuve de présence est encore récente. Lorsqu'il
   * répond REAUTHENTIFICATION_REQUISE, on demande le mot de passe, ouvre la
   * fenêtre de ré-authentification officielle puis rejoue exactement l'action.
   */
  async function avecReauthentification(action) {
    try {
      return await action();
    } catch (erreur) {
      if (!erreur || erreur.code !== 'REAUTHENTIFICATION_REQUISE') throw erreur;

      const motDePasse = await demanderMotDePasse();
      if (!motDePasse) return null;

      await SA.api('/super-admin/control-center/reauthentifier', {
        method: 'POST',
        body: JSON.stringify({ mot_de_passe: motDePasse })
      });
      return action();
    }
  }

  function demanderMotDePasse() {
    return new Promise((resoudre) => {
      const modale = SA.modale({
        titre: 'Confirmez votre mot de passe',
        sousTitre: "La suppression d'une école agit sur la production et exige une preuve de présence récente.",
        contenu: `
          <p class="sa-texte" style="margin-top:0">
            Votre mot de passe n'est utilisé que pour ouvrir la fenêtre de
            ré-authentification sécurisée du Super Admin. L'action reste en plus
            protégée par la phrase de suppression exacte.
          </p>
          <label class="sa-champ-bloc"><span>Mot de passe</span>
            <input type="password" class="sa-champ" id="supp-ecole-reauth-mdp"
                   autocomplete="current-password" />
          </label>`,
        actions: `
          <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
          <button class="sa-bouton sa-bouton-principal" data-role="confirmer">Confirmer</button>`
      });

      const champ = modale.querySelector('#supp-ecole-reauth-mdp');
      const terminer = (valeur) => {
        modale.fermer();
        resoudre(valeur || null);
      };
      const valider = () => terminer(champ.value);

      modale.querySelector('[data-role="annuler"]').addEventListener('click', () => terminer(null));
      modale.querySelector('[data-role="confirmer"]').addEventListener('click', valider);
      champ.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          valider();
        }
      });
      setTimeout(() => champ.focus(), 30);
    });
  }

  const recherche = SA.modale({
    titre: 'Supprimer définitivement une école',
    sousTitre: 'Cette opération est irréversible.',
    contenu: `
      <p class="sa-note" style="margin-bottom:14px">
        Entrez d'abord le <strong>code exact de connexion</strong> de l'école.
        Ardoise vérifiera l'établissement avant d'afficher la confirmation finale.
      </p>
      <label class="sa-champ-bloc">
        <span>Code de l'école</span>
        <input class="sa-champ" id="supp-ecole-code" autocomplete="off"
               placeholder="ex. college-boboto" />
      </label>`,
    actions: `
      <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
      <button class="sa-bouton sa-bouton-danger" data-role="chercher">Continuer</button>`
  });

  recherche.querySelector('[data-role="annuler"]').addEventListener('click', () => recherche.fermer());
  const champCode = recherche.querySelector('#supp-ecole-code');
  const boutonChercher = recherche.querySelector('[data-role="chercher"]');
  champCode.focus();

  async function continuer() {
    const codeSaisi = champCode.value.trim();
    if (!codeSaisi) return SA.toast("Saisissez le code de l'école.", 'attention');

    boutonChercher.disabled = true;
    boutonChercher.textContent = 'Vérification…';
    try {
      const liste = await SA.api(SA.url('/super-admin/ecoles', {
        recherche: codeSaisi,
        page: 1
      }));
      const ecole = (liste.donnees || []).find((e) =>
        String(e.code || '').toLowerCase() === codeSaisi.toLowerCase());

      if (!ecole) {
        SA.toast('Aucune école ne porte exactement ce code.', 'erreur');
        return;
      }

      const detail = await SA.api(`/admin/ecoles/${ecole.id}`);
      recherche.fermer();
      ouvrirConfirmation(detail);
    } catch (erreur) {
      SA.toast(erreur.message || "Impossible de vérifier l'école.", 'erreur');
    } finally {
      boutonChercher.disabled = false;
      boutonChercher.textContent = 'Continuer';
    }
  }

  boutonChercher.addEventListener('click', continuer);
  champCode.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') {
      ev.preventDefault();
      continuer();
    }
  });

  function ouvrirConfirmation(detail) {
    const ecole = detail.ecole;
    const stats = detail.stats || {};
    const phrase = `SUPPRIMER ${ecole.code}`;

    const modale = SA.modale({
      titre: 'Confirmation finale',
      sousTitre: `« ${ecole.nom} » sera supprimée définitivement.`,
      contenu: `
        <div class="sa-note" style="border-left:3px solid var(--rouge,#B23A2E);margin-bottom:16px">
          <strong>Cette action ne peut pas être annulée.</strong><br>
          Elle supprimera les comptes de l'école, élèves, classes, notes, bulletins,
          abonnements, paiements et documents rattachés au tenant.
        </div>
        <div class="sa-liste-infos" style="margin-bottom:16px">
          <div class="sa-ligne-info"><span>École</span><strong>${esc(ecole.nom)}</strong></div>
          <div class="sa-ligne-info"><span>Code</span><span class="sa-mono">${esc(ecole.code)}</span></div>
          <div class="sa-ligne-info"><span>Élèves actifs</span><span>${esc(String(stats.nb_eleves ?? '—'))}</span></div>
          <div class="sa-ligne-info"><span>Utilisateurs</span><span>${esc(String(stats.nb_utilisateurs ?? '—'))}</span></div>
          <div class="sa-ligne-info"><span>Classes</span><span>${esc(String(stats.nb_classes ?? '—'))}</span></div>
        </div>
        <label class="sa-champ-bloc">
          <span>Tapez exactement <span class="sa-mono">${esc(phrase)}</span></span>
          <input class="sa-champ sa-mono" id="supp-ecole-confirmation"
                 autocomplete="off" spellcheck="false" />
        </label>`,
      actions: `
        <button class="sa-bouton sa-bouton-secondaire" data-role="annuler">Annuler</button>
        <button class="sa-bouton sa-bouton-danger" data-role="supprimer" disabled>
          Supprimer définitivement
        </button>`,
      large: true
    });

    const champ = modale.querySelector('#supp-ecole-confirmation');
    const bouton = modale.querySelector('[data-role="supprimer"]');
    modale.querySelector('[data-role="annuler"]').addEventListener('click', () => modale.fermer());

    champ.addEventListener('input', () => {
      bouton.disabled = champ.value !== phrase;
    });
    champ.focus();

    bouton.addEventListener('click', async () => {
      if (champ.value !== phrase) return;
      bouton.disabled = true;
      bouton.textContent = 'Suppression…';

      try {
        const resultat = await avecReauthentification(() =>
          SA.api(`/admin/ecoles/${ecole.id}`, {
            method: 'DELETE',
            body: JSON.stringify({ confirmation: phrase })
          })
        );

        if (!resultat) {
          bouton.disabled = false;
          bouton.textContent = 'Supprimer définitivement';
          return;
        }

        modale.fermer();
        SA.toast('École supprimée définitivement.', 'succes', 8000);
        if (resultat.stockage && resultat.stockage.complet === false) {
          SA.toast(
            'La base est supprimée, mais certains fichiers Storage doivent être vérifiés.',
            'attention',
            12000
          );
        }
        SA.naviguer('ecoles', { page: 1 });
      } catch (erreur) {
        bouton.disabled = false;
        bouton.textContent = 'Supprimer définitivement';
        SA.toast(erreur.message || "La suppression n'a pas abouti.", 'erreur', 10000);
      }
    });
  }
}

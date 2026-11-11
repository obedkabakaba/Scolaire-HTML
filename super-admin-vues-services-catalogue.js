/* =============================================================================
   SUPER ADMIN — CATALOGUE DES SERVICES (écoles et centres de formation)
   =============================================================================

   Installation et configuration, formation du personnel, campagne de capture,
   conception du site : chaque service a un prix pour les écoles, un prix pour
   les centres de formation (la configuration d'un centre coûte 35 $ au lieu de
   60 $) et une liste de ceux qui peuvent le commander. Les commandes déjà
   passées gardent leur prix figé : changer un prix ici ne réécrit rien.

   Routes : GET /super-admin/catalogue-services, PATCH /super-admin/catalogue-services/:id
   Dépend de super-admin-vues-offres.js (SA.finance.formulaire, envoyer).
   ============================================================================= */
(function () {
  'use strict';

  const SA = window.SA;
  const ui = SA.ui;
  const esc = SA.esc;
  const FIN = () => SA.finance || {};

  const argent = (v, devise) => (v === null || v === undefined || v === '')
    ? '<span class="sa-muet">même prix que les écoles</span>'
    : `${esc(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(Number(v)))}&nbsp;${esc(devise === 'USD' ? '$' : (devise || '$'))}`;

  const pourQui = (t) => {
    const l = Array.isArray(t) ? t : ['ecole', 'centre_formation'];
    return [l.includes('ecole') ? ui.badge('Écoles', 'info') : '', l.includes('centre_formation') ? ui.badge('Centres', 'succes') : ''].join(' ');
  };

  SA.enregistrerVue('catalogue-services', {
    titre: 'Catalogue des services',
    sousTitre: 'Prix pour les écoles, prix pour les centres de formation, et qui peut commander chaque service.',

    async rendu(conteneur) {
      conteneur.innerHTML = ui.squelette(3, 80);
      const lignes = await SA.api('/super-admin/catalogue-services');

      conteneur.innerHTML = `
        <section class="sa-section">
          <p class="sa-note">Un centre de formation voit le prix « centre » (et son unité : par apprenant au lieu de par élève). Vide = le même prix que pour les écoles.
            Les commandes passées gardent le prix du jour de la commande.</p>
          ${ui.tableau({
            lignes, vide: 'Aucun service au catalogue',
            colonnes: [
              { cle: 'nom', titre: 'Service', rendu: (l) => `<strong>${esc(l.nom)}</strong><div class="sa-muet sa-mono">${esc(l.code || '')}</div>` },
              { cle: 'pour', titre: 'Pour qui', rendu: (l) => pourQui(l.types_structure) },
              { cle: 'prix', titre: 'Prix école', rendu: (l) => `${argent(l.prix_unitaire, l.devise)}${l.unite ? `<div class="sa-muet">${esc(l.unite)}</div>` : ''}` },
              { cle: 'prix_centre', titre: 'Prix centre', rendu: (l) => `${argent(l.prix_centre, l.devise)}${l.unite_centre ? `<div class="sa-muet">par ${esc(l.unite_centre)}</div>` : ''}` },
              { cle: 'commandes', titre: 'Commandes', rendu: (l) => `${esc(l.commandes)}${l.commandes_centres ? `<div class="sa-muet">dont ${esc(l.commandes_centres)} de centres</div>` : ''}` },
              { cle: 'statut', titre: 'Statut', rendu: (l) => ui.badge(l.statut === 'actif' ? 'actif' : 'inactif', l.statut === 'actif' ? 'succes' : 'neutre') },
              { cle: 'act', titre: '', rendu: (l) => `<button class="sa-bouton sa-bouton-secondaire sa-bouton-petit" data-modifier="${esc(l.id)}">Modifier</button>` }
            ]
          })}
        </section>`;

      conteneur.querySelectorAll('[data-modifier]').forEach((b) => b.addEventListener('click', () => {
        const l = lignes.find((x) => String(x.id) === b.dataset.modifier);
        if (!l || !FIN().formulaire) return;
        const t = Array.isArray(l.types_structure) ? l.types_structure : ['ecole', 'centre_formation'];
        FIN().formulaire({
          titre: l.nom,
          sousTitre: 'Les commandes déjà passées ne changent pas.',
          champs: [
            { cle: 'pour_ecoles', libelle: 'Écoles', type: 'bascule', texteBascule: 'Les écoles peuvent le commander', valeur: t.includes('ecole') },
            { cle: 'pour_centres', libelle: 'Centres de formation', type: 'bascule', texteBascule: 'Les centres peuvent le commander', valeur: t.includes('centre_formation') },
            { cle: 'prix_unitaire', libelle: `Prix pour une école (${l.devise || 'USD'})`, type: 'nombre', min: 0, requis: true, valeur: l.prix_unitaire },
            { cle: 'prix_centre', libelle: `Prix pour un centre (${l.devise || 'USD'})`, type: 'nombre', min: 0, valeur: l.prix_centre, aide: 'Vide = même prix que pour les écoles.' },
            { cle: 'unite_centre', libelle: 'Unité facturée au centre', valeur: l.unite_centre, exemple: 'Ex. apprenant', aide: 'Pour un service facturé à l’unité (capture : par apprenant).' },
            { cle: 'statut', libelle: 'Statut', type: 'liste', valeur: l.statut === 'actif' ? 'actif' : 'inactif', options: [{ valeur: 'actif', libelle: 'Actif' }, { valeur: 'inactif', libelle: 'Inactif' }] }
          ],
          libelleValider: 'Enregistrer',
          soumettre: (v) => {
            const types = [v.pour_ecoles ? 'ecole' : null, v.pour_centres ? 'centre_formation' : null].filter(Boolean);
            return FIN().envoyer(`/super-admin/catalogue-services/${l.id}`, 'PATCH', {
              prix_unitaire: v.prix_unitaire, prix_centre: v.prix_centre, unite_centre: v.unite_centre, types_structure: types, statut: v.statut
            }, 'Service mis à jour.');
          }
        });
      }));
    }
  });
})();

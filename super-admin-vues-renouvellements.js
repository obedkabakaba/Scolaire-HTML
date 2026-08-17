/* Super Admin — demandes de renouvellement des écoles. */
(function enregistrerQuandPret() {
  'use strict';
  if (!window.SA || typeof SA.enregistrerVue !== 'function') {
    setTimeout(enregistrerQuandPret, 30);
    return;
  }
  if (SA.vues && SA.vues.has && SA.vues.has('renouvellements')) return;

  var ui = SA.ui, esc = SA.esc;
  var LIB = { en_attente_paiement:'Dépôt en attente', a_verifier:'À vérifier', agent_demande:'Agent demandé', validee:'Validée', refusee:'Refusée', annulee:'Annulée' };
  var TON = { a_verifier:'attention', agent_demande:'attention', en_attente_paiement:'neutre', validee:'succes', refusee:'danger', annulee:'neutre' };

  function injecterMenu() {
    if (document.querySelector('[data-route="renouvellements"]')) return;
    var groupe = document.querySelector('[data-groupe="offres"] .sa-sous-menu');
    if (!groupe) return;
    var li = document.createElement('li');
    li.innerHTML = '<a href="#/renouvellements" data-route="renouvellements">Renouvellements à traiter</a>';
    groupe.appendChild(li);
  }

  function modalAction(ligne, mode, apresAction) {
    var validation = mode === 'valider';
    var reference = ligne.reference_transaction || '';
    var contenu = validation
      ? '<p class="sa-texte">Validez seulement après avoir vérifié que le paiement est réellement reçu.</p>'
        + '<label class="sa-champ"><span>Méthode constatée</span><select id="renouv-methode">'
        + '<option value="mpesa">M-Pesa</option><option value="orange_money">Orange Money</option>'
        + '<option value="airtel_money">Airtel Money</option><option value="especes">Espèces</option>'
        + '<option value="virement_bancaire">Virement bancaire</option><option value="cheque">Chèque</option></select></label>'
        + '<label class="sa-champ"><span>Référence vérifiée / reçu</span><input id="renouv-ref" value="'+esc(reference)+'" /></label>'
        + '<label class="sa-champ"><span>Note interne (facultative)</span><textarea id="renouv-note" rows="2"></textarea></label>'
      : '<p class="sa-texte">Le motif sera envoyé à l’école. Pour un dépôt, elle pourra corriger sa référence et la soumettre à nouveau.</p>'
        + '<label class="sa-champ"><span>Motif</span><textarea id="renouv-motif" rows="3" placeholder="Ex. Référence introuvable dans le relevé"></textarea></label>';

    var m = SA.modale({
      titre: validation ? 'Valider le renouvellement' : 'Refuser la demande',
      sousTitre: ligne.ecole_nom + ' — ' + ligne.plan_nom,
      contenu: contenu + '<p data-erreur class="sa-erreur-modale" hidden></p>',
      actions: '<button class="sa-bouton sa-bouton-secondaire" data-annuler>Annuler</button>'
        + '<button class="sa-bouton '+(validation?'sa-bouton-principal':'sa-bouton-danger')+'" data-valider>'
        +(validation?'Activer l’abonnement':'Refuser')+'</button>'
    });
    m.querySelector('[data-annuler]').onclick = function(){ m.fermer(); };
    m.querySelector('[data-valider]').onclick = async function(){
      var bouton=this, erreur=m.querySelector('[data-erreur]'); bouton.disabled=true;
      try {
        var body = { confirmation:true };
        var chemin;
        if (validation) {
          body.methode = m.querySelector('#renouv-methode').value;
          body.reference = m.querySelector('#renouv-ref').value.trim();
          body.note = m.querySelector('#renouv-note').value.trim();
          if (body.reference.length < 3) throw new Error('Une référence ou un numéro de reçu est requis.');
          chemin = '/super-admin/renouvellements/'+ligne.id+'/valider';
        } else {
          body.motif = m.querySelector('#renouv-motif').value.trim();
          if (body.motif.length < 3) throw new Error('Indiquez le motif du refus.');
          chemin = '/super-admin/renouvellements/'+ligne.id+'/refuser';
        }
        var r = await SA.api(chemin,{method:'POST',body:JSON.stringify(body)});
        m.fermer();
        SA.toast(r.message || 'Demande mise à jour.','succes');
        if (typeof apresAction === 'function') apresAction();
      } catch(e) {
        erreur.hidden=false;
        erreur.textContent=e.message||'Opération impossible.';
      } finally {
        bouton.disabled=false;
      }
    };
  }

  SA.enregistrerVue('renouvellements', {
    titre: 'Renouvellements',
    sousTitre: 'Paiements déclarés et demandes de passage d’un agent, à traiter en priorité.',
    async rendu(conteneur, params) {
      injecterMenu();
      clearTimeout(window.__ardoiseRenouvellementsTimer);
      conteneur.innerHTML = ui.squeletteCartes(3) + ui.squelette(6,44);

      var statut = params.statut || 'tous';
      var empreinte = '';

      function urlListe() {
        return SA.url('/super-admin/renouvellements',{statut:statut==='tous'?undefined:statut});
      }

      function signature(r) {
        var s=r.statistiques||{};
        return JSON.stringify([
          Number(s.a_verifier)||0, Number(s.agents)||0, Number(s.ouvertes)||0,
          (r.donnees||[]).map(function(l){return [l.id,l.statut,l.updated_at,l.reference_transaction,l.refuse_motif,l.mode_paiement]})
        ]);
      }

      function peindre(r) {
        var s = r.statistiques || {}, lignes = r.donnees || [];
        conteneur.innerHTML = '<section class="sa-section"><div class="sa-grille-stats">'
          + ui.carteStat({valeur:s.a_verifier||0,etiquette:'Paiements à vérifier',ton:Number(s.a_verifier)>0?'attention':'neutre'})
          + ui.carteStat({valeur:s.agents||0,etiquette:'Agents demandés',ton:Number(s.agents)>0?'attention':'neutre'})
          + ui.carteStat({valeur:s.ouvertes||0,etiquette:'Demandes ouvertes',ton:'info'})
          + '</div></section>'
          + '<section class="sa-section"><div class="sa-barre-filtres"><select id="renouv-filtre">'
          + ['tous','a_verifier','agent_demande','en_attente_paiement','validee','refusee'].map(function(x){return '<option value="'+x+'"'+(x===statut?' selected':'')+'>'+(x==='tous'?'Tous les statuts':(LIB[x]||x))+'</option>'}).join('')
          + '</select><button type="button" class="sa-bouton sa-bouton-secondaire sa-bouton-petit" id="renouv-actualiser">Actualiser</button></div>'
          + ui.tableau({
            colonnes:[
              {cle:'ecole',titre:'École',rendu:function(l){return '<strong>'+esc(l.ecole_nom)+'</strong><div class="sa-muet sa-mono">'+esc(l.ecole_code||'')+'</div><div class="sa-muet">'+esc([l.adresse,l.commune,l.ville].filter(Boolean).join(' · '))+'</div>'}},
              {cle:'contact',titre:'Contact',rendu:function(l){var tel=l.ecole_telephone?'<div>'+esc(l.ecole_telephone)+'</div>':'';var mail=l.ecole_email?'<div class="sa-muet">'+esc(l.ecole_email)+'</div>':'';return tel+mail||'<span class="sa-muet">—</span>'}},
              {cle:'offre',titre:'Offre',rendu:function(l){return esc(l.plan_nom)+'<div class="sa-muet">'+esc(l.periodicite)+'</div>'}},
              {cle:'montant',titre:'Montant',classe:'sa-num',rendu:function(l){return '<strong>'+SA.fmt.nombre(Number(l.montant_attendu))+' '+esc(l.devise)+'</strong>'}},
              {cle:'mode',titre:'Mode',rendu:function(l){if(l.mode_paiement==='agent')return ui.badge('Agent','attention');return 'Dépôt'+(l.reseau_depot?' · '+esc(l.reseau_depot):'')}},
              {cle:'reference',titre:'Référence',rendu:function(l){return l.reference_transaction?'<span class="sa-mono">'+esc(l.reference_transaction)+'</span>':'<span class="sa-muet">—</span>'}},
              {cle:'statut',titre:'Statut',rendu:function(l){return ui.badge(LIB[l.statut]||l.statut,TON[l.statut]||'neutre')}},
              {cle:'date',titre:'Demandé',rendu:function(l){return '<span class="sa-muet">'+SA.fmt.date(l.created_at)+'</span>'}},
              {cle:'actions',titre:'',classe:'sa-actions',rendu:function(l){if(!['a_verifier','agent_demande'].includes(l.statut))return'';return '<div class="sa-groupe-actions"><button class="sa-bouton sa-bouton-petit sa-bouton-principal" data-renouv="valider" data-id="'+esc(l.id)+'">Valider</button><button class="sa-bouton sa-bouton-petit sa-bouton-secondaire" data-renouv="refuser" data-id="'+esc(l.id)+'">Refuser</button></div>'}}
            ],
            lignes:lignes,
            vide:'Aucune demande de renouvellement'
          }) + '</section>';

        var par={};
        lignes.forEach(function(l){par[l.id]=l});
        conteneur.querySelectorAll('[data-renouv]').forEach(function(b){
          b.onclick=function(){var l=par[b.dataset.id];if(l)modalAction(l,b.dataset.renouv,function(){chargerSilencieusement(true)})};
        });
        var f=conteneur.querySelector('#renouv-filtre');
        if(f)f.onchange=function(){SA.majParams({statut:f.value});SA.rafraichirVue()};
        var actualiser=conteneur.querySelector('#renouv-actualiser');
        if(actualiser)actualiser.onclick=function(){chargerSilencieusement(true,actualiser)};
      }

      async function chargerSilencieusement(forcer, bouton) {
        var texte;
        if(bouton){texte=bouton.textContent;bouton.disabled=true;bouton.textContent='Actualisation…'}
        try {
          var r = await SA.api(urlListe());
          var sig = signature(r);
          if (forcer || sig !== empreinte) {
            empreinte = sig;
            peindre(r);
          }
        } catch(e) {
          if(forcer)SA.toast(e.message||'Impossible d’actualiser les renouvellements.','erreur');
        } finally {
          if(bouton && document.body.contains(bouton)){bouton.disabled=false;bouton.textContent=texte||'Actualiser'}
        }
      }

      function programmerSync() {
        clearTimeout(window.__ardoiseRenouvellementsTimer);
        window.__ardoiseRenouvellementsTimer=setTimeout(async function(){
          if(location.hash.indexOf('#/renouvellements')!==0)return;
          await chargerSilencieusement(false);
          programmerSync();
        },10000);
      }

      await chargerSilencieusement(true);
      programmerSync();
    }
  });

  injecterMenu();
  if (location.hash.indexOf('#/renouvellements') === 0 && SA.rafraichirVue) setTimeout(SA.rafraichirVue, 0);
})();

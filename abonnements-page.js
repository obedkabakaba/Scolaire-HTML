(function(){
  'use strict';
  if(!window.ArdoiseSession||!ArdoiseSession.connecte()){location.replace('connexion.html');return;}

  var data=null, planChoisi=null, derniereVersionDemande='';
  var $=function(id){return document.getElementById(id)};
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function api(path,opt){return ArdoiseSession.appelApi(path,opt||{}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok){var e=new Error(j.message||'Opération impossible.');e.status=r.status;throw e}return j})})}
  function money(n,d){var v=Number(n);return Number.isFinite(v)?v.toLocaleString('fr-FR',{maximumFractionDigits:2})+' '+(d||'USD'):'—'}
  function prix(p,per){if(per==='annuel')return p.prix_annuel==null?Number(p.prix)*12:Number(p.prix_annuel);if(per==='semestriel')return p.prix_semestriel==null?Number(p.prix)*6:Number(p.prix_semestriel);return Number(p.prix)}
  function libPeriode(p){return p==='annuel'?'Annuel':p==='semestriel'?'6 mois':'Mensuel'}
  function libStatut(s){return({en_attente_paiement:'Dépôt à effectuer',a_verifier:'Paiement en vérification',agent_demande:'Agent demandé',validee:'Abonnement activé',refusee:'Paiement à corriger',annulee:'Demande remplacée'})[s]||s}
  function dateCourte(v){if(!v)return'—';try{return new Date(v).toLocaleDateString('fr-FR',{day:'2-digit',month:'short',year:'numeric'})}catch(e){return'—'}}
  function flash(message,type){var e=$('message-flash');if(!e)return;e.textContent=message;e.style.background=type==='erreur'?'var(--rouge)':type==='succes'?'var(--vert-ok)':'var(--ardoise)';e.classList.add('visible');clearTimeout(e._t);e._t=setTimeout(function(){e.classList.remove('visible')},4200)}
  function setBusy(btn,on,texte){if(!btn)return;if(on){btn.dataset.texte=btn.textContent;btn.disabled=true;btn.textContent=texte||'Traitement…'}else{btn.disabled=false;if(btn.dataset.texte)btn.textContent=btn.dataset.texte}}
  function versionDemande(d){return d?[d.id,d.statut,d.updated_at,d.reference_transaction,d.refuse_motif].join('|'):''}

  function setStep(n){document.querySelectorAll('.tunnel-etape').forEach(function(e){var s=Number(e.dataset.step);e.classList.toggle('actif',s===n);e.classList.toggle('fait',s<n)})}

  function renduEcole(){var e=data.ecole||{};$('ecole').innerHTML=''
    +'<div class="resume-case"><small>École</small><strong>'+esc(e.nom||'—')+'</strong><div class="muted code" style="margin-top:4px">'+esc(e.code||'')+'</div></div>'
    +'<div class="resume-case"><small>Bouquet actuel</small><strong>'+esc(e.plan_nom||'Aucun')+'</strong></div>'
    +'<div class="resume-case"><small>Échéance</small><strong>'+dateCourte(e.date_expiration)+'</strong></div>';
    var compact=$('etat-compact');if(compact)compact.textContent=e.abonnement_statut?String(e.abonnement_statut).replace(/_/g,' '):'Sans abonnement';
  }

  function renduEtat(){var d=data&&data.demande, zone=$('etat-demande');if(!d||d.statut==='annulee'){zone.innerHTML='';return}var cls=d.statut==='validee'?' succes':d.statut==='refusee'?' erreur':'';var aide='';
    if(d.statut==='en_attente_paiement')aide='Effectuez le dépôt puis envoyez la référence de transaction.';
    if(d.statut==='a_verifier')aide='Ardoise a reçu votre référence. Le paiement doit maintenant être vérifié.';
    if(d.statut==='agent_demande')aide='Ardoise a reçu votre demande et vos coordonnées pour organiser le passage.';
    if(d.statut==='refusee')aide='Vous pouvez corriger la référence et la renvoyer sans recommencer tout le parcours.';
    if(d.statut==='validee')aide='Votre renouvellement a été validé.';
    zone.innerHTML='<div class="etat-demande'+cls+'"><div class="etat-demande-ligne"><strong>'+esc(libStatut(d.statut))+'</strong><span>'+esc(d.plan_nom||'')+' · '+esc(libPeriode(d.periodicite||''))+' · '+money(d.montant_attendu,d.devise)+'</span></div><p>'+esc(aide)+'</p>'+(d.reference_transaction?'<div class="etat-reference">Référence : <span class="code">'+esc(d.reference_transaction)+'</span></div>':'')+(d.refuse_motif?'<div class="etat-motif"><strong>Motif :</strong> '+esc(d.refuse_motif)+'</div>':'')+'</div>';
  }

  function features(p){var f=Array.isArray(p.fonctionnalites_incluses)?p.fonctionnalites_incluses:[];return f.slice(0,5).map(function(x){var t=typeof x==='string'?x:(x.nom||x.cle||'');return t?'<li>'+esc(t.replace(/_/g,' '))+'</li>':''}).join('')}
  function renduPlans(){var courant=(data.ecole||{}).abonnement_plan_id, plans=data.plans||[];if(!plans.length){$('plans').innerHTML='<div class="carte-section erreur">Aucune offre disponible pour le moment.</div>';return}$('plans').innerHTML=plans.map(function(p){var actuel=p.id===courant;return '<article class="plan '+(actuel?'actuel':'')+'">'+(actuel?'<span class="plan-badge">Votre bouquet actuel</span>':'')+'<h3>'+esc(p.nom)+'</h3><div class="plan-desc">'+esc(p.positionnement||p.description||'')+'</div><div class="plan-prix">'+money(p.prix,p.devise)+' <small>/ mois</small></div><ul>'+features(p)+'</ul><button type="button" class="bouton '+(actuel?'bouton-principal':'bouton-secondaire')+'" data-plan="'+esc(p.id)+'">'+(actuel?'Renouveler cette offre':'Choisir cette offre')+'</button></article>'}).join('');document.querySelectorAll('[data-plan]').forEach(function(b){b.addEventListener('click',function(){planChoisi=plans.find(function(p){return p.id===b.dataset.plan})||null;ouvrirFlux()})})}

  function actualiserPeriodes(){if(!planChoisi)return;['mensuel','semestriel','annuel'].forEach(function(per){var e=$('prix-'+per);if(e)e.textContent=money(prix(planChoisi,per),planChoisi.devise)});actualiserSelection()}
  function choisirPeriode(per){$('periodicite').value=per;document.querySelectorAll('[data-periode]').forEach(function(b){b.classList.toggle('actif',b.dataset.periode===per)});actualiserSelection()}
  function actualiserSelection(){if(!planChoisi)return;var per=$('periodicite').value;$('selection').innerHTML='<div><small>Offre choisie</small><strong>'+esc(planChoisi.nom)+'</strong></div><div><small>Durée</small><strong>'+esc(libPeriode(per))+'</strong></div><div><small>Montant</small><strong>'+money(prix(planChoisi,per),planChoisi.devise)+'</strong></div>'}

  function renduDisponibiliteDepot(){var d=data.depot||{}, z=$('depot-disponibilite');if(!z)return;if(!d.disponible){z.innerHTML='<span class="indispo-point"></span>Dépôt temporairement indisponible : utilisez un agent.';$('btn-depot').disabled=true;return}$('btn-depot').disabled=false;z.innerHTML='<span class="dispo-point"></span>Dépôt disponible'+(d.reseau?' via '+esc(d.reseau):'')+'. Le numéro apparaît après « Continuer ».'}

  function ouvrirFlux(){if(!planChoisi)return;$('flux').classList.remove('cache');$('choix-zone').classList.remove('cache');$('reference-zone').classList.add('cache');$('confirmation-zone').classList.add('cache');setStep(1);actualiserPeriodes();renduDisponibiliteDepot();setTimeout(function(){$('flux').scrollIntoView({behavior:'smooth',block:'start'})},30)}

  function afficherEtapeDepot(demande){var d=demande||data.demande||{}, dep=data.depot||{};$('choix-zone').classList.add('cache');$('confirmation-zone').classList.add('cache');$('reference-zone').classList.remove('cache');setStep(2);$('montant-depot').textContent=money(d.montant_attendu!=null?d.montant_attendu:prix(planChoisi,$('periodicite').value),d.devise||(planChoisi&&planChoisi.devise));$('reseau-depot').textContent=d.reseau_depot||dep.reseau||'Dépôt Ardoise';$('numero-depot').textContent=d.numero_depot||dep.numero||'—';$('nom-depot').textContent=d.nom_depot||dep.nom||'Ardoise';setTimeout(function(){$('reference-zone').scrollIntoView({behavior:'smooth',block:'start'});$('reference').focus({preventScroll:true})},40)}

  function afficherConfirmation(type){$('choix-zone').classList.add('cache');$('reference-zone').classList.add('cache');$('confirmation-zone').classList.remove('cache');setStep(3);if(type==='agent'){$('confirmation-titre').textContent='Votre demande d’agent est envoyée';$('confirmation-texte').textContent='Ardoise a reçu les coordonnées et l’adresse de votre école. Un agent pourra vous contacter pour organiser le règlement.'}else{$('confirmation-titre').textContent='Référence envoyée pour vérification';$('confirmation-texte').textContent='Ardoise a été averti. Dès que le dépôt est vérifié, votre abonnement sera activé et vous serez notifié.'}setTimeout(function(){$('confirmation-zone').scrollIntoView({behavior:'smooth',block:'center'})},40)}

  function creer(mode,btn){if(!planChoisi)return;var per=$('periodicite').value;setBusy(btn,true,mode==='agent'?'Envoi de la demande…':'Préparation du dépôt…');api('/abonnements/renouvellements',{method:'POST',body:{plan_id:planChoisi.id,periodicite:per,mode_paiement:mode}}).then(function(r){data.demande=r.demande||data.demande;derniereVersionDemande=versionDemande(data.demande);renduEtat();if(mode==='depot'){afficherEtapeDepot(data.demande)}else{afficherConfirmation('agent')}flash(r.message||'Demande enregistrée.','succes')}).catch(function(e){flash(e.message,'erreur')}).finally(function(){setBusy(btn,false)})}

  function envoyerReference(){var d=data&&data.demande, ref=$('reference').value.trim(), btn=$('btn-reference');if(!d||!['en_attente_paiement','refusee'].includes(d.statut)){flash('Cette demande n’attend pas de nouvelle référence.','erreur');return}if(ref.length<4){flash('Entrez la référence complète de la transaction.','erreur');$('reference').focus();return}setBusy(btn,true,'Envoi pour vérification…');api('/abonnements/renouvellements/'+encodeURIComponent(d.id)+'/reference',{method:'PATCH',body:{reference:ref}}).then(function(r){data.demande=r.demande||data.demande;derniereVersionDemande=versionDemande(data.demande);$('reference').value='';renduEtat();afficherConfirmation('reference');flash(r.message||'Référence transmise.','succes')}).catch(function(e){flash(e.message,'erreur')}).finally(function(){setBusy(btn,false)})}

  function restaurerDemande(){var d=data&&data.demande;if(!d||!d.plan_id)return;planChoisi=(data.plans||[]).find(function(p){return p.id===d.plan_id})||null;if(!planChoisi)return;$('periodicite').value=d.periodicite||'annuel';document.querySelectorAll('[data-periode]').forEach(function(b){b.classList.toggle('actif',b.dataset.periode===$('periodicite').value)});$('flux').classList.remove('cache');actualiserPeriodes();renduDisponibiliteDepot();if(d.statut==='en_attente_paiement'||d.statut==='refusee'){afficherEtapeDepot(d)}else if(d.statut==='a_verifier'){afficherConfirmation('reference')}else if(d.statut==='agent_demande'){afficherConfirmation('agent')}else{$('flux').classList.add('cache')}}

  function charger(premier){if(premier){$('plans').innerHTML='<div class="carte-section muted">Chargement des offres…</div>'}$('erreur-chargement').classList.add('cache');return api('/abonnements/renouvellement').then(function(r){data=r;derniereVersionDemande=versionDemande(r.demande);renduEcole();renduEtat();renduPlans();renduDisponibiliteDepot();restaurerDemande();return r}).catch(function(e){$('erreur-chargement').classList.remove('cache');$('erreur-chargement').innerHTML='<strong>Impossible de charger les abonnements.</strong><br><span class="aide">'+esc(e.message)+'</span>';$('plans').innerHTML='';flash(e.message,'erreur');throw e})}

  function synchroniserSilencieusement(){if(document.hidden)return;api('/abonnements/renouvellement').then(function(r){var nouvelle=versionDemande(r.demande);var statutChange=nouvelle!==derniereVersionDemande;data.ecole=r.ecole;data.depot=r.depot;data.demande=r.demande;derniereVersionDemande=nouvelle;renduEcole();if(statutChange){renduEtat();if(r.demande&&r.demande.statut==='validee'){flash('Paiement validé : votre abonnement est actif.','succes');$('flux').classList.add('cache')}else if(r.demande&&r.demande.statut==='refusee'){restaurerDemande()}}}).catch(function(){})}

  document.querySelectorAll('[data-periode]').forEach(function(b){b.addEventListener('click',function(){choisirPeriode(b.dataset.periode)})});
  $('btn-depot').addEventListener('click',function(){creer('depot',this)});
  $('btn-agent').addEventListener('click',function(){creer('agent',this)});
  $('btn-reference').addEventListener('click',envoyerReference);
  $('changer-mode').addEventListener('click',function(){$('reference-zone').classList.add('cache');$('choix-zone').classList.remove('cache');setStep(1);flash('Choisissez un autre mode de règlement. La nouvelle demande remplacera la précédente.','info')});
  $('copier-numero').addEventListener('click',function(){var numero=$('numero-depot').textContent.trim();if(!numero||numero==='—')return;var btn=this;function ok(){var ancien=btn.textContent;btn.textContent='Numéro copié ✓';setTimeout(function(){btn.textContent=ancien},1800)}if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(numero).then(ok).catch(function(){})}else{var t=document.createElement('textarea');t.value=numero;document.body.appendChild(t);t.select();try{document.execCommand('copy');ok()}catch(e){}t.remove()}});
  $('reessayer').addEventListener('click',function(){charger(true).catch(function(){})});
  $('bouton-deconnexion-nav').addEventListener('click',function(){ArdoiseSession.terminer()});

  charger(true).catch(function(){});
  setInterval(synchroniserSilencieusement,20000);
})();

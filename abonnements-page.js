(function(){
  'use strict';
  if(!window.ArdoiseSession||!ArdoiseSession.connecte()){location.replace('connexion.html');return;}

  var data=null, planChoisi=null;
  var $=function(id){return document.getElementById(id)};
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function api(path,opt){return ArdoiseSession.appelApi(path,opt||{}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok){var e=new Error(j.message||'Opération impossible.');e.status=r.status;throw e}return j})})}
  function money(n,d){var v=Number(n);return Number.isFinite(v)?v.toLocaleString('fr-FR',{maximumFractionDigits:2})+' '+(d||'USD'):'—'}
  function prix(p,per){if(per==='annuel')return p.prix_annuel==null?Number(p.prix)*12:Number(p.prix_annuel);if(per==='semestriel')return p.prix_semestriel==null?Number(p.prix)*6:Number(p.prix_semestriel);return Number(p.prix)}
  function libStatut(s){return({en_attente_paiement:'Dépôt à effectuer',a_verifier:'Paiement en vérification',agent_demande:'Agent demandé',validee:'Abonnement activé',refusee:'Paiement à corriger',annulee:'Demande remplacée'})[s]||s}
  function flash(message,type){var e=$('message-flash');if(!e)return;e.textContent=message;e.style.background=type==='erreur'?'var(--rouge)':type==='succes'?'var(--vert-ok)':'var(--ardoise)';e.classList.add('visible');clearTimeout(e._t);e._t=setTimeout(function(){e.classList.remove('visible')},4500)}
  function setBusy(btn,on,texte){if(!btn)return;if(on){btn.dataset.texte=btn.textContent;btn.disabled=true;btn.textContent=texte||'Traitement…'}else{btn.disabled=false;if(btn.dataset.texte)btn.textContent=btn.dataset.texte}}

  function renduEcole(){var e=data.ecole||{};$('ecole').innerHTML=''
    +'<div class="resume-case"><small>École</small><strong>'+esc(e.nom||'—')+'</strong><div class="muted code" style="margin-top:4px">'+esc(e.code||'')+'</div></div>'
    +'<div class="resume-case"><small>Bouquet actuel</small><strong>'+esc(e.plan_nom||'Aucun')+'</strong></div>'
    +'<div class="resume-case"><small>Statut</small><strong>'+esc(e.abonnement_statut||'Sans abonnement')+'</strong></div>';
  }

  function renduEtat(){var d=data&&data.demande, zone=$('etat-demande');if(!d){zone.innerHTML='';return}var cls=d.statut==='validee'?' succes':d.statut==='refusee'?' erreur':'';zone.innerHTML='<div class="etat-demande'+cls+'"><strong>'+esc(libStatut(d.statut))+'</strong><div class="muted" style="margin-top:4px">'+esc(d.plan_nom||'')+' · '+esc(d.periodicite||'')+' · '+money(d.montant_attendu,d.devise)+(d.reference_transaction?'<br>Référence : <span class="code">'+esc(d.reference_transaction)+'</span>':'')+(d.refuse_motif?'<br>Motif : '+esc(d.refuse_motif):'')+'</div></div>'}

  function features(p){var f=Array.isArray(p.fonctionnalites_incluses)?p.fonctionnalites_incluses:[];return f.slice(0,5).map(function(x){var t=typeof x==='string'?x:(x.nom||x.cle||'');return t?'<li>'+esc(t.replace(/_/g,' '))+'</li>':''}).join('')}
  function renduPlans(){var courant=(data.ecole||{}).abonnement_plan_id, plans=data.plans||[];if(!plans.length){$('plans').innerHTML='<div class="carte-section erreur">Aucune offre disponible pour le moment.</div>';return}$('plans').innerHTML=plans.map(function(p){var actuel=p.id===courant;return '<article class="plan '+(actuel?'actuel':'')+'">'+(actuel?'<span class="plan-badge">Votre bouquet actuel</span>':'')+'<h3>'+esc(p.nom)+'</h3><div class="plan-desc">'+esc(p.positionnement||p.description||'')+'</div><div class="plan-prix">'+money(p.prix,p.devise)+' <small>/ mois</small></div><ul>'+features(p)+'</ul><button type="button" class="bouton '+(actuel?'bouton-principal':'bouton-secondaire')+'" data-plan="'+esc(p.id)+'">'+(actuel?'Renouveler':'Choisir cette offre')+'</button></article>'}).join('');document.querySelectorAll('[data-plan]').forEach(function(b){b.addEventListener('click',function(){planChoisi=plans.find(function(p){return p.id===b.dataset.plan})||null;ouvrirFlux()})})}

  function instructionsDepot(){var d=data.depot||{};if(!d.disponible){$('instructions-depot').innerHTML='<div class="depot-infos erreur"><strong>Dépôt temporairement indisponible.</strong><br>Le numéro n’est pas encore configuré. Vous pouvez demander le passage d’un agent.</div>';$('btn-depot').disabled=true;return}$('btn-depot').disabled=false;$('instructions-depot').innerHTML='<div class="depot-infos"><strong>'+esc(d.reseau||'Dépôt Ardoise')+'</strong><br><span class="code" style="font-size:1rem">'+esc(d.numero)+'</span>'+(d.nom?'<br>Titulaire : '+esc(d.nom):'')+'</div>'}
  function actualiserSelection(){if(!planChoisi)return;var per=$('periodicite').value;$('selection').innerHTML='<strong>'+esc(planChoisi.nom)+'</strong> · '+esc(per)+' · <strong>'+money(prix(planChoisi,per),planChoisi.devise)+'</strong>';}
  function ouvrirFlux(){if(!planChoisi)return;$('flux').classList.remove('cache');actualiserSelection();instructionsDepot();setTimeout(function(){$('flux').scrollIntoView({behavior:'smooth',block:'start'})},30)}

  function creer(mode,btn){if(!planChoisi)return;var per=$('periodicite').value;setBusy(btn,true,mode==='agent'?'Envoi à Ardoise…':'Préparation…');api('/abonnements/renouvellements',{method:'POST',body:{plan_id:planChoisi.id,periodicite:per,mode_paiement:mode}}).then(function(r){flash(r.message||'Demande enregistrée.','succes');if(mode==='depot'){$('reference-zone').classList.remove('cache');var d=data.depot||{};$('depot-rappel').innerHTML='Déposez <strong>'+money(prix(planChoisi,per),planChoisi.devise)+'</strong> sur <strong>'+esc(d.reseau||'le compte Ardoise')+'</strong> — <span class="code">'+esc(d.numero||'')+'</span>, puis saisissez la référence exacte ci-dessous.'}return charger(false)}).catch(function(e){flash(e.message,'erreur')}).finally(function(){setBusy(btn,false)})}

  function envoyerReference(){var d=data&&data.demande, ref=$('reference').value.trim(), btn=$('btn-reference');if(!d){flash('Créez d’abord une demande de dépôt.','erreur');return}if(ref.length<4){flash('Entrez la référence complète de la transaction.','erreur');return}setBusy(btn,true,'Envoi pour vérification…');api('/abonnements/renouvellements/'+encodeURIComponent(d.id)+'/reference',{method:'PATCH',body:{reference:ref}}).then(function(r){$('reference').value='';flash(r.message||'Référence transmise.','succes');return charger(false)}).catch(function(e){flash(e.message,'erreur')}).finally(function(){setBusy(btn,false)})}

  function restaurerDemande(){var d=data&&data.demande;if(!d)return;if((d.statut==='en_attente_paiement'||d.statut==='refusee')&&d.plan_id){planChoisi=(data.plans||[]).find(function(p){return p.id===d.plan_id})||null;if(planChoisi){$('periodicite').value=d.periodicite||'annuel';ouvrirFlux();$('reference-zone').classList.remove('cache');var dep=data.depot||{};$('depot-rappel').innerHTML='Montant attendu : <strong>'+money(d.montant_attendu,d.devise)+'</strong>'+(dep.numero?'<br>'+esc(dep.reseau||'')+' — <span class="code">'+esc(dep.numero)+'</span>':'')}}}

  function charger(premier){if(premier!==false){$('plans').innerHTML='<div class="carte-section muted">Chargement des offres…</div>'}$('erreur-chargement').classList.add('cache');return api('/abonnements/renouvellement').then(function(r){data=r;renduEcole();renduEtat();renduPlans();instructionsDepot();restaurerDemande();return r}).catch(function(e){$('erreur-chargement').classList.remove('cache');$('erreur-chargement').innerHTML='<strong>Impossible de charger les abonnements.</strong><br><span class="aide">'+esc(e.message)+'</span>';$('plans').innerHTML='';flash(e.message,'erreur');throw e})}

  $('periodicite').addEventListener('change',actualiserSelection);
  $('btn-depot').addEventListener('click',function(){creer('depot',this)});
  $('btn-agent').addEventListener('click',function(){creer('agent',this)});
  $('btn-reference').addEventListener('click',envoyerReference);
  $('reessayer').addEventListener('click',function(){charger(true).catch(function(){})});
  $('bouton-deconnexion-nav').addEventListener('click',function(){ArdoiseSession.terminer()});

  charger(true).catch(function(){});
  setInterval(function(){charger(false).catch(function(){})},15000);
})();

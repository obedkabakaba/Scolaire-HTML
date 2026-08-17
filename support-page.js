(function(){
  'use strict';
  if(!window.ArdoiseSession||!ArdoiseSession.connecte()){location.replace('connexion.html');return;}

  var actif=null;
  var $=function(id){return document.getElementById(id)};
  function esc(v){return String(v==null?'':v).replace(/[&<>"']/g,function(c){return({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]})}
  function api(path,opt){return ArdoiseSession.appelApi(path,opt||{}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok){var e=new Error(j.message||'Opération impossible.');e.status=r.status;throw e}return j})})}
  function statut(s){return({ouvert:'Ouvert',en_cours:'En cours',attente_client:'Réponse attendue',resolu:'Résolu',ferme:'Fermé'})[s]||s}
  function date(v){try{return new Date(v).toLocaleString('fr-FR',{dateStyle:'short',timeStyle:'short'})}catch(e){return''}}
  function flash(message,type){var e=$('message-flash');if(!e)return;e.textContent=message;e.style.background=type==='erreur'?'var(--rouge)':type==='succes'?'var(--vert-ok)':'var(--ardoise)';e.classList.add('visible');clearTimeout(e._t);e._t=setTimeout(function(){e.classList.remove('visible')},4500)}
  function setBusy(btn,on,texte){if(!btn)return;if(on){btn.dataset.texte=btn.textContent;btn.disabled=true;btn.textContent=texte||'Traitement…'}else{btn.disabled=false;if(btn.dataset.texte)btn.textContent=btn.dataset.texte}}

  function afficherVue(vue){var nouveau=vue==='nouveau';$('nouvelle-demande').classList.toggle('cache',!nouveau);$('centre-tickets').classList.toggle('cache',nouveau);$('action-nouveau').classList.toggle('actif',nouveau);$('action-tickets').classList.toggle('actif',!nouveau);if(nouveau)setTimeout(function(){$('sujet').focus()},30)}

  function chargerListe(silencieux){if(!silencieux)$('tickets').innerHTML='<div class="vide">Chargement de vos demandes…</div>';return api('/abonnements/support/tickets').then(function(r){var l=r.donnees||[];$('compteur-tickets').textContent=l.length?l.length+' demande'+(l.length>1?'s':''):'Aucune demande';$('tickets').innerHTML=l.length?l.map(function(t){return '<button type="button" class="ticket'+(t.id===actif?' actif':'')+'" data-id="'+esc(t.id)+'"><div class="ticket-top"><strong>'+esc(t.sujet)+'</strong><span class="badge">'+esc(statut(t.statut))+'</span></div><div class="ticket-meta"><span class="code">'+esc(t.reference)+'</span> · '+esc(t.categorie)+'<br>Mis à jour '+date(t.updated_at)+'</div></button>'}).join(''):'<div class="vide etat-vide">Aucune demande pour le moment.<br><button type="button" class="bouton bouton-principal" id="creer-premier" style="margin-top:12px">Créer une demande</button></div>';document.querySelectorAll('.ticket').forEach(function(x){x.addEventListener('click',function(){ouvrir(x.dataset.id,true)})});var p=$('creer-premier');if(p)p.addEventListener('click',function(){afficherVue('nouveau')});return l}).catch(function(e){$('tickets').innerHTML='<div class="erreur aide">'+esc(e.message)+'</div>';flash(e.message,'erreur');throw e})}

  function ouvrir(id,defiler){actif=id;document.querySelectorAll('.ticket').forEach(function(t){t.classList.toggle('actif',t.dataset.id===id)});$('detail-vide').classList.add('cache');$('detail').classList.remove('cache');$('detail-entete').innerHTML='<div class="muted">Chargement de la conversation…</div>';return api('/abonnements/support/tickets/'+encodeURIComponent(id)).then(function(r){$('detail-entete').innerHTML='<div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start"><div><h3 style="margin:0 0 5px">'+esc(r.ticket.sujet)+'</h3><div class="aide"><span class="code">'+esc(r.ticket.reference)+'</span> · '+esc(r.ticket.categorie)+' · '+date(r.ticket.updated_at)+'</div></div><span class="badge">'+esc(statut(r.ticket.statut))+'</span></div>';$('messages').innerHTML=(r.messages||[]).map(function(m){return '<div class="msg '+(m.cote==='support'?'support':'')+'">'+esc(m.contenu)+'<small>'+esc(m.auteur||(m.cote==='support'?'Support Ardoise':'Vous'))+' · '+date(m.created_at)+'</small></div>'}).join('')||'<div class="vide">Aucun message.</div>';$('messages').scrollTop=$('messages').scrollHeight;$('zone-reponse').classList.toggle('cache',r.ticket.statut==='ferme');if(defiler&&window.matchMedia('(max-width:780px)').matches)setTimeout(function(){$('detail').scrollIntoView({behavior:'smooth',block:'start'})},30);return r}).catch(function(e){$('detail-entete').innerHTML='<div class="erreur">'+esc(e.message)+'</div>';flash(e.message,'erreur')})}

  function creerTicket(){var btn=$('creer'),sujet=$('sujet').value.trim(),description=$('description').value.trim();if(sujet.length<4||description.length<8){flash('Ajoutez un sujet clair et quelques détails sur le problème.','erreur');return}setBusy(btn,true,'Envoi au support…');api('/abonnements/support/tickets',{method:'POST',body:{categorie:$('categorie').value,priorite:$('priorite').value,sujet:sujet,description:description}}).then(function(r){$('sujet').value='';$('description').value='';flash(r.message||'Demande envoyée.','succes');afficherVue('tickets');return chargerListe(true).then(function(){return ouvrir(r.ticket.id,true)})}).catch(function(e){flash(e.message,'erreur')}).finally(function(){setBusy(btn,false)})}

  function repondre(){if(!actif)return;var contenu=$('reponse').value.trim(),btn=$('envoyer-reponse');if(contenu.length<2){flash('Écrivez votre message avant de l’envoyer.','erreur');return}setBusy(btn,true,'Envoi…');api('/abonnements/support/tickets/'+encodeURIComponent(actif)+'/messages',{method:'POST',body:{contenu:contenu}}).then(function(){$('reponse').value='';flash('Message envoyé. Le support Ardoise a été averti.','succes');return Promise.all([ouvrir(actif,false),chargerListe(true)])}).catch(function(e){flash(e.message,'erreur')}).finally(function(){setBusy(btn,false)})}

  $('action-nouveau').addEventListener('click',function(){afficherVue('nouveau')});
  $('action-tickets').addEventListener('click',function(){afficherVue('tickets')});
  $('annuler-nouveau').addEventListener('click',function(){afficherVue('tickets')});
  $('creer').addEventListener('click',creerTicket);
  $('envoyer-reponse').addEventListener('click',repondre);
  $('reponse').addEventListener('keydown',function(e){if((e.ctrlKey||e.metaKey)&&e.key==='Enter'){e.preventDefault();repondre()}});
  $('bouton-deconnexion-nav').addEventListener('click',function(){ArdoiseSession.terminer()});

  afficherVue('tickets');
  chargerListe(false).catch(function(){});
  setInterval(function(){chargerListe(true).then(function(){if(actif&&!$('reponse').value.trim()&&document.activeElement!==$('reponse'))ouvrir(actif,false)}).catch(function(){})},15000);
})();

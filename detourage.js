/* ==========================================================================
   ARDOISE — DÉTOURAGE DES LOGOS, CACHETS ET SIGNATURES
   --------------------------------------------------------------------------
   Un logo photographié ou scanné arrive presque toujours sur un fond blanc
   ou uni. Posé sur un en-tête coloré, un certificat ou un site sombre, ce
   rectangle de fond fait amateur. Ce fichier le retire, dans le navigateur,
   sans rien envoyer à un service tiers et sans télécharger de modèle d'IA
   (des dizaines de mégaoctets, impensable sur une connexion mobile).

   LA MÉTHODE — et pourquoi rien n'est jamais coupé du logo
     1. La couleur du fond est lue sur le POURTOUR de l'image (médiane).
     2. On « remplit » depuis les bords uniquement : seules les zones
        de fond RELIÉES au bord deviennent transparentes. Le blanc à
        l'intérieur d'un logo (l'œil d'une lettre, un fond de blason)
        n'est pas relié au bord : il reste intact.
     3. Les contours sont adoucis (transparence progressive) et décontaminés :
        la teinte du fond est retirée des pixels de bord, pour éviter le
        liseré blanc sur fond sombre.
     4. Recadrage sur le logo, avec une marge : on retire du vide, jamais
        un pixel du logo.
   L'utilisateur voit l'avant et l'après sur fond clair, sombre et damier,
   règle la précision, peut cliquer sur une zone restante pour l'effacer,
   et garde l'original s'il préfère.

   API : ArdoiseDetourage.proposer(fichier, { titre }) → Promise<File>
         (le fichier détouré en PNG, ou l'original si l'utilisateur le garde)
   ========================================================================== */
(function () {
  'use strict';

  var MAX_COTE = 2000;

  function chargerImage(fichier) {
    return new Promise(function (ok, ko) {
      var url = URL.createObjectURL(fichier);
      var img = new Image();
      img.onload = function () { ok(img); };
      img.onerror = function () { URL.revokeObjectURL(url); ko(new Error('Image illisible.')); };
      img.src = url;
    });
  }

  function versCanvas(img) {
    var echelle = Math.min(1, MAX_COTE / Math.max(img.naturalWidth, img.naturalHeight));
    var c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * echelle));
    c.height = Math.max(1, Math.round(img.naturalHeight * echelle));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c;
  }

  // Distance de couleur « redmean » : proche de la perception, sans le coût du Lab.
  function distance(r1, g1, b1, r2, g2, b2) {
    var rm = (r1 + r2) / 2, dr = r1 - r2, dg = g1 - g2, db = b1 - b2;
    return Math.sqrt((2 + rm / 256) * dr * dr + 4 * dg * dg + (2 + (255 - rm) / 256) * db * db);
  }

  /** Couleur et uniformité du pourtour ; transparence déjà présente. */
  function analyser(source) {
    var w = source.width, h = source.height, d = source.getContext('2d').getImageData(0, 0, w, h).data;
    var R = [], G = [], B = [], transparents = 0, total = 0;
    function lire(x, y) {
      var i = (y * w + x) * 4; total++;
      if (d[i + 3] < 200) { transparents++; return; }
      R.push(d[i]); G.push(d[i + 1]); B.push(d[i + 2]);
    }
    for (var x = 0; x < w; x++) { lire(x, 0); lire(x, h - 1); if (h > 3) { lire(x, 1); lire(x, h - 2); } }
    for (var y = 2; y < h - 2; y++) { lire(0, y); lire(w - 1, y); if (w > 3) { lire(1, y); lire(w - 2, y); } }
    var med = function (t) { if (!t.length) return 255; t.sort(function (a, b) { return a - b; }); return t[Math.floor(t.length / 2)]; };
    var fond = [med(R), med(G), med(B)];
    var proches = 0;
    for (var k = 0; k < R.length; k++) if (distance(R[k], G[k], B[k], fond[0], fond[1], fond[2]) < 60) proches++;
    return {
      fond: fond,
      uniformite: R.length ? proches / R.length : 0,
      dejaTransparent: total ? transparents / total > 0.5 : false
    };
  }

  /**
   * Détoure `source` (canvas). `options.tolerance` : 10 (strict) … 160 (large).
   * `options.graines` : points supplémentaires cliqués par l'utilisateur.
   */
  function detourer(source, options) {
    options = options || {};
    var tol = options.tolerance || 55;
    var w = source.width, h = source.height;
    var ctx = source.getContext('2d');
    var image = ctx.getImageData(0, 0, w, h), d = image.data;
    var info = options.info || analyser(source);
    var fr = info.fond[0], fg = info.fond[1], fb = info.fond[2];
    var haut = tol, bas = tol * 0.45;
    var alpha = new Uint8ClampedArray(w * h);
    for (var p = 0; p < w * h; p++) alpha[p] = d[p * 4 + 3];

    if (!info.dejaTransparent) {
      var vu = new Uint8Array(w * h);
      var file = new Int32Array(w * h), tete = 0, queue = 0;
      var pousser = function (x, y) {
        var q = y * w + x;
        if (vu[q]) return;
        var i = q * 4;
        if (distance(d[i], d[i + 1], d[i + 2], fr, fg, fb) >= haut) return;
        vu[q] = 1; file[queue++] = q;
      };
      for (var x = 0; x < w; x++) { pousser(x, 0); pousser(x, h - 1); }
      for (var y = 0; y < h; y++) { pousser(0, y); pousser(w - 1, y); }
      (options.graines || []).forEach(function (g) {
        var gx = Math.max(0, Math.min(w - 1, Math.round(g.x))), gy = Math.max(0, Math.min(h - 1, Math.round(g.y)));
        var i = (gy * w + gx) * 4;
        // Une zone cliquée est retirée d'après SA couleur, pas celle du bord.
        var cr = d[i], cg = d[i + 1], cb = d[i + 2];
        var pile = [gy * w + gx], vus = new Uint8Array(w * h);
        while (pile.length) {
          var q = pile.pop();
          if (vus[q] || vu[q]) continue;
          vus[q] = 1;
          var j = q * 4;
          if (distance(d[j], d[j + 1], d[j + 2], cr, cg, cb) >= haut) continue;
          vu[q] = 1; alpha[q] = 0;
          var qx = q % w, qy = (q - qx) / w;
          if (qx > 0) pile.push(q - 1); if (qx < w - 1) pile.push(q + 1);
          if (qy > 0) pile.push(q - w); if (qy < h - 1) pile.push(q + w);
        }
      });
      while (tete < queue) {
        var q = file[tete++], qx = q % w, qy = (q - qx) / w;
        var i = q * 4;
        var dist = distance(d[i], d[i + 1], d[i + 2], fr, fg, fb);
        // Transparence progressive : nette dans le fond, douce au contour.
        alpha[q] = dist <= bas ? 0 : Math.round(255 * (dist - bas) / (haut - bas));
        if (qx > 0) pousser(qx - 1, qy); if (qx < w - 1) pousser(qx + 1, qy);
        if (qy > 0) pousser(qx, qy - 1); if (qy < h - 1) pousser(qx, qy + 1);
      }
      // Pixels de contour non atteints mais voisins du fond : ce sont les pixels
      // « mélangés » de l'anticrénelage (moitié logo, moitié fond). Leur part de
      // fond se mesure par projection entre la couleur du fond et celle du
      // logo deux pixels plus loin : c'est ce qui supprime le liseré clair.
      var bordure = [];
      for (var by = 0; by < h; by++) for (var bx = 0; bx < w; bx++) {
        var bq = by * w + bx;
        // Pixels de fond en transition (transparence partielle) : même calcul.
        if (vu[bq]) { if (alpha[bq] > 0) bordure.push(bq); continue; }
        if ((bx > 0 && vu[bq - 1]) || (bx < w - 1 && vu[bq + 1]) || (by > 0 && vu[bq - w]) || (by < h - 1 && vu[bq + w])) bordure.push(bq);
      }
      bordure.forEach(function (bq) {
        var bx = bq % w, by = (bq - bx) / w, bi = bq * 4;
        var meilleur = -1, fx = d[bi], fy = d[bi + 1], fz = d[bi + 2];
        for (var oy = -2; oy <= 2; oy++) for (var ox = -2; ox <= 2; ox++) {
          var nx = bx + ox, ny = by + oy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          var nq = ny * w + nx; if (vu[nq]) continue;
          var ni = nq * 4, dd = distance(d[ni], d[ni + 1], d[ni + 2], fr, fg, fb);
          if (dd > meilleur) { meilleur = dd; fx = d[ni]; fy = d[ni + 1]; fz = d[ni + 2]; }
        }
        var vx = fx - fr, vy = fy - fg, vz = fz - fb, norme = vx * vx + vy * vy + vz * vz;
        if (norme < 1 || meilleur < 0) { if (vu[bq]) alpha[bq] = 0; return; }
        var part = ((d[bi] - fr) * vx + (d[bi + 1] - fg) * vy + (d[bi + 2] - fb) * vz) / norme;
        alpha[bq] = Math.round(255 * Math.max(0, Math.min(1, part)));
      });
      // Décontamination : retirer la teinte du fond des pixels semi-transparents.
      for (var k = 0; k < w * h; k++) {
        var a = alpha[k] / 255;
        if (a > 0 && a < 1) {
          var m = k * 4;
          d[m] = Math.max(0, Math.min(255, (d[m] - (1 - a) * fr) / a));
          d[m + 1] = Math.max(0, Math.min(255, (d[m + 1] - (1 - a) * fg) / a));
          d[m + 2] = Math.max(0, Math.min(255, (d[m + 2] - (1 - a) * fb) / a));
        }
        d[k * 4 + 3] = alpha[k];
      }
    }

    // Recadrage : la boîte du logo, plus une marge. Aucun pixel visible retiré.
    var x0 = w, y0 = h, x1 = -1, y1 = -1;
    for (var yy = 0; yy < h; yy++) for (var xx = 0; xx < w; xx++) {
      if (d[(yy * w + xx) * 4 + 3] > 8) { if (xx < x0) x0 = xx; if (xx > x1) x1 = xx; if (yy < y0) y0 = yy; if (yy > y1) y1 = yy; }
    }
    var sortie = document.createElement('canvas');
    if (x1 < 0) { sortie.width = w; sortie.height = h; sortie.getContext('2d').putImageData(image, 0, 0); return { canvas: sortie, vide: true, info: info }; }
    var marge = Math.max(2, Math.round(Math.max(x1 - x0, y1 - y0) * 0.03));
    x0 = Math.max(0, x0 - marge); y0 = Math.max(0, y0 - marge); x1 = Math.min(w - 1, x1 + marge); y1 = Math.min(h - 1, y1 + marge);
    var tmp = document.createElement('canvas'); tmp.width = w; tmp.height = h;
    tmp.getContext('2d').putImageData(image, 0, 0);
    sortie.width = x1 - x0 + 1; sortie.height = y1 - y0 + 1;
    sortie.getContext('2d').drawImage(tmp, x0, y0, sortie.width, sortie.height, 0, 0, sortie.width, sortie.height);
    var transparence = 0;
    for (var t = 3; t < d.length; t += 4) if (d[t] < 128) transparence++;
    return { canvas: sortie, vide: false, info: info, part_retiree: transparence / (w * h), recadre: { x: x0, y: y0 } };
  }

  function versFichier(canvas, nom) {
    return new Promise(function (ok) {
      canvas.toBlob(function (blob) { ok(new File([blob], nom, { type: 'image/png' })); }, 'image/png');
    });
  }

  /* -------------------------------------------------------------- Interface */
  var STYLE = '.ard-det-voile{position:fixed;inset:0;background:rgba(15,20,18,.55);z-index:2000;display:flex;align-items:flex-start;justify-content:center;overflow:auto;padding:4vh 12px;font-family:Inter,system-ui,sans-serif}' +
    '.ard-det{background:#FBF9F3;color:#1F2B24;border-radius:16px;width:min(920px,100%);box-shadow:0 20px 60px rgba(0,0,0,.3)}' +
    '.ard-det header{padding:16px 20px;border-bottom:1px solid #E4DFCF;display:flex;justify-content:space-between;gap:10px;align-items:center}.ard-det header h2{margin:0;font:600 1.15rem Georgia,serif}' +
    '.ard-det .corps{padding:16px 20px}.ard-det .grille{display:grid;grid-template-columns:1fr 1fr;gap:14px}@media(max-width:640px){.ard-det .grille{grid-template-columns:1fr}}' +
    '.ard-det figure{margin:0;border:1px solid #E4DFCF;border-radius:12px;overflow:hidden;background:#fff}.ard-det figcaption{font-size:.78rem;font-weight:600;color:#6B7269;padding:8px 10px;border-bottom:1px solid #E4DFCF;display:flex;justify-content:space-between}' +
    '.ard-det .scene{height:230px;display:flex;align-items:center;justify-content:center;padding:14px}.ard-det .scene img,.ard-det .scene canvas{max-width:100%;max-height:100%;object-fit:contain}' +
    '.ard-det .damier{background-color:#fff;background-image:linear-gradient(45deg,#e6e6e6 25%,transparent 25%),linear-gradient(-45deg,#e6e6e6 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e6e6e6 75%),linear-gradient(-45deg,transparent 75%,#e6e6e6 75%);background-size:18px 18px;background-position:0 0,0 9px,9px -9px,-9px 0}' +
    '.ard-det .fonds{display:flex;gap:6px}.ard-det .fonds button{width:22px;height:22px;border-radius:50%;border:2px solid #E4DFCF;cursor:pointer;padding:0}.ard-det .fonds button.on{border-color:#C98A3E}' +
    '.ard-det .reglage{display:flex;align-items:center;gap:12px;margin-top:14px;flex-wrap:wrap;font-size:.86rem}.ard-det input[type=range]{flex:1;min-width:180px}' +
    '.ard-det .note{font-size:.82rem;color:#6B7269;margin-top:10px;line-height:1.5}.ard-det .alerte{background:#FFF8EE;border:1px solid #F0D9B5;border-radius:10px;padding:8px 10px;font-size:.84rem;margin-top:10px}' +
    '.ard-det footer{padding:14px 20px;border-top:1px solid #E4DFCF;display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}' +
    '.ard-det .btn{padding:9px 14px;border-radius:10px;border:1.5px solid #E4DFCF;background:#fff;font:600 .88rem Inter,system-ui,sans-serif;cursor:pointer;color:#1F2B24}.ard-det .btn.principal{background:#C98A3E;border-color:#C98A3E;color:#fff}.ard-det .btn.actif{border-color:#C98A3E;background:#FFF8EE}';

  function proposer(fichier, opts) {
    opts = opts || {};
    if (!fichier || !/^image\/(png|jpe?g|webp|gif|bmp)$/i.test(fichier.type || '')) return Promise.resolve(fichier);
    return chargerImage(fichier).then(function (img) {
      var source = versCanvas(img);
      var info = analyser(source);
      return new Promise(function (resoudre) {
        if (!document.getElementById('ard-det-style')) { var st = document.createElement('style'); st.id = 'ard-det-style'; st.textContent = STYLE; document.head.appendChild(st); }
        var v = document.createElement('div');
        v.className = 'ard-det-voile';
        v.innerHTML = '<div class="ard-det" role="dialog" aria-modal="true" aria-label="Détourage"><header><h2>' + (opts.titre || 'Détourer le logo') + '</h2><button class="btn" data-garder>Garder l’original</button></header><div class="corps">' +
          '<div class="grille"><figure><figcaption>Original</figcaption><div class="scene" style="background:#fff"><img alt="Original"></div></figure>' +
          '<figure><figcaption><span>Détouré — cliquez une zone restante pour l’effacer</span><span class="fonds"><button data-fond="damier" class="on damier" title="Damier"></button><button data-fond="#ffffff" style="background:#fff" title="Fond clair"></button><button data-fond="#1F2B24" style="background:#1F2B24" title="Fond sombre"></button><button data-fond="#1E4E8C" style="background:#1E4E8C" title="Fond de couleur"></button></span></figcaption><div class="scene damier" data-scene style="cursor:crosshair"></div></figure></div>' +
          '<div class="reglage"><label for="ard-det-tol">Précision</label><span style="font-size:.78rem;color:#6B7269">fine</span><input type="range" id="ard-det-tol" min="12" max="160" value="' + (opts.tolerance || 55) + '"><span style="font-size:.78rem;color:#6B7269">large</span>' +
          '<button class="btn" data-annuler-clics>Annuler les zones cliquées</button></div>' +
          '<div data-alerte></div><p class="note">Le fond relié au bord de l’image est retiré ; ce qui est à l’intérieur du logo (lettres, blason, fond blanc encadré) est conservé. Le recadrage ne retire que du vide. Rien n’est envoyé à un service extérieur.</p></div>' +
          '<footer><button class="btn" data-garder>Garder l’original</button><button class="btn principal" data-utiliser>Utiliser le logo détouré</button></footer></div>';
        document.body.appendChild(v);
        v.querySelector('img').src = source.toDataURL('image/png');
        var scene = v.querySelector('[data-scene]');
        var graines = [], resultat = null;
        function rendre() {
          var tol = Number(v.querySelector('#ard-det-tol').value);
          var copie = document.createElement('canvas'); copie.width = source.width; copie.height = source.height;
          copie.getContext('2d').drawImage(source, 0, 0);
          resultat = detourer(copie, { tolerance: tol, graines: graines, info: info });
          scene.innerHTML = ''; scene.appendChild(resultat.canvas);
          var alertes = [];
          if (info.dejaTransparent) alertes.push('Cette image est déjà détourée : elle a seulement été recadrée.');
          else if (info.uniformite < 0.6) alertes.push('Le fond de cette image n’est pas uni (photo, dégradé). Vérifiez le résultat, cliquez les zones restantes pour les effacer, ou gardez l’original.');
          if (resultat.vide) alertes.push('Tout a été retiré : diminuez la précision, ou gardez l’original.');
          v.querySelector('[data-alerte]').innerHTML = alertes.map(function (a) { return '<div class="alerte">' + a + '</div>'; }).join('');
        }
        var minuterie;
        v.querySelector('#ard-det-tol').addEventListener('input', function () { clearTimeout(minuterie); minuterie = setTimeout(rendre, 120); });
        scene.addEventListener('click', function (ev) {
          var c = scene.querySelector('canvas'); if (!c || !resultat) return;
          var rect = c.getBoundingClientRect();
          var x = (ev.clientX - rect.left) / rect.width * c.width + (resultat.recadre ? resultat.recadre.x : 0);
          var y = (ev.clientY - rect.top) / rect.height * c.height + (resultat.recadre ? resultat.recadre.y : 0);
          graines.push({ x: x, y: y }); rendre();
        });
        v.querySelector('[data-annuler-clics]').addEventListener('click', function () { graines = []; rendre(); });
        v.querySelectorAll('[data-fond]').forEach(function (b) {
          b.addEventListener('click', function () {
            v.querySelectorAll('[data-fond]').forEach(function (x) { x.classList.toggle('on', x === b); });
            var f = b.getAttribute('data-fond');
            scene.classList.toggle('damier', f === 'damier');
            scene.style.background = f === 'damier' ? '' : f;
          });
        });
        function fermer(f) { v.remove(); resoudre(f); }
        v.querySelectorAll('[data-garder]').forEach(function (b) { b.addEventListener('click', function () { fermer(fichier); }); });
        v.querySelector('[data-utiliser]').addEventListener('click', function () {
          if (!resultat || resultat.vide) { fermer(fichier); return; }
          versFichier(resultat.canvas, (fichier.name || 'logo').replace(/\.[a-z0-9]+$/i, '') + '-detoure.png').then(fermer);
        });
        rendre();
      });
    }).catch(function () { return fichier; });
  }

  window.ArdoiseDetourage = { proposer: proposer, detourer: detourer, analyser: analyser, versCanvas: versCanvas };
})();

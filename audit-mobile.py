#!/usr/bin/env python3
"""
Audit responsive PAR LA MESURE — et non par lecture du code source.

POURQUOI CELUI-CI EN PLUS DE `audit-responsive.py`
--------------------------------------------------
L'audit statique cherche des causes probables dans le texte des fichiers :
largeurs fixes, media queries manquantes, tableaux sans conteneur. Il est utile
et rapide, mais il est passé à côté de l'essentiel — il déclarait huit pages
concernées quand treize débordaient réellement, et il n'a signalé aucune des
barres d'onglets qui étaient la vraie cause.

Celui-ci ouvre chaque page dans un navigateur sans interface, à 360 px de
large, avec une session simulée, et pose la seule question qui compte :

    document.documentElement.scrollWidth > 360 ?

Si oui, la page oblige à dézoomer. Il remonte ensuite l'élément fautif, ce qui
transforme « c'est pas responsive » en « c'est `.onglets` de rapports.html ».

INSTALLATION
------------
    pip install playwright && python3 -m playwright install chromium

USAGE
-----
    python3 audit-mobile.py                 # toutes les pages du dossier
    python3 audit-mobile.py . eleves.html   # une page précise
"""
import http.server, socketserver, threading, functools, sys, os, json
from playwright.sync_api import sync_playwright

RACINE = sys.argv[1] if len(sys.argv) > 1 else 'work/Scolaire-HTML-main'
PORT = 8099
LARGEUR, HAUTEUR = 360, 780

class Silencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

Handler = functools.partial(Silencieux, directory=RACINE)
socketserver.TCPServer.allow_reuse_address = True
srv = socketserver.TCPServer(("", PORT), Handler)
threading.Thread(target=srv.serve_forever, daemon=True).start()

PAGES = [f for f in sorted(os.listdir(RACINE)) if f.endswith('.html')]
if len(sys.argv) > 2:
    PAGES = sys.argv[2:]

SESSION = """
localStorage.setItem('ardoise_access_token','faux-jeton-de-test');
localStorage.setItem('ardoise_refresh_token','faux');
localStorage.setItem('ardoise_user', JSON.stringify({
  id:1, nom:'Test', prenom:'Utilisateur', email:'t@t.cd',
  roles:['directeur','secretaire','professeur','titulaire'],
  ecole_id:1, ecole:{id:1,nom:'École Test'}
}));
"""

SONDE = """
() => {
  const vw = document.documentElement.clientWidth;
  const debord = [];
  const vus = new Set();
  document.querySelectorAll('body *').forEach(el => {
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return;
    const r = el.getBoundingClientRect();
    if (r.width === 0 && r.height === 0) return;
    const droite = r.right + window.scrollX;
    if (droite > vw + 1 || r.left < -1) {
      // On ne garde que le plus haut ancêtre fautif de chaque branche
      let p = el.parentElement, couvert = false;
      while (p) { if (vus.has(p)) { couvert = true; break; } p = p.parentElement; }
      if (couvert) return;
      vus.add(el);
      debord.push({
        tag: el.tagName.toLowerCase(),
        cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').toString().slice(0,70),
        id: el.id || '',
        largeur: Math.round(r.width),
        droite: Math.round(droite),
      });
    }
  });
  return {
    vw,
    scrollW: document.documentElement.scrollWidth,
    bodyScrollW: document.body.scrollWidth,
    debord: debord.slice(0, 12),
    nav: {
      burger: !!document.querySelector('.bouton-menu'),
      listeVisible: (() => { const l = document.querySelector('.nav-liste');
        if (!l) return 'absente';
        const s = getComputedStyle(l); return s.display + '/' + s.visibility; })(),
      items: document.querySelectorAll('.nav-liste li').length,
      itemsVisibles: [...document.querySelectorAll('.nav-liste li')].filter(li => getComputedStyle(li).display !== 'none').length,
      sansIcone: [...document.querySelectorAll('.nav-liste .nav-item')].filter(a => !a.querySelector('.nav-icone')).map(a => a.textContent.trim().slice(0,30)),
    },
    aide: (() => {
      const li = document.getElementById('ard-di-nav');
      if (!li) return 'absente';
      const s = getComputedStyle(li);
      return { display: s.display, icone: !!li.querySelector('.nav-icone'), href: (li.querySelector('a')||{}).getAttribute ? li.querySelector('a').getAttribute('href') : null };
    })(),
    petitTexte: [...document.querySelectorAll('body *')].filter(el => {
      const s = getComputedStyle(el);
      return el.children.length === 0 && el.textContent.trim() && parseFloat(s.fontSize) < 11.5;
    }).length,
    ciblesPetites: [...document.querySelectorAll('button, a.bouton, .lien-action, input[type=checkbox]')].filter(el => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.height < 36;
    }).length,
  };
}
"""

resultats = {}
with sync_playwright() as p:
    nav = p.chromium.launch()
    ctx = nav.new_context(viewport={'width': LARGEUR, 'height': HAUTEUR},
                          device_scale_factor=2, is_mobile=True, has_touch=True,
                          user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148')
    ctx.add_init_script(SESSION)
    # Le backend n'existe pas ici : on répond du vide plutôt que d'attendre.
    ctx.route('**://scolaire-saas-backend.onrender.com/**',
              lambda route: route.fulfill(status=200, content_type='application/json', body='{}'))
    ctx.route('**://fonts.googleapis.com/**', lambda route: route.abort())
    ctx.route('**://fonts.gstatic.com/**', lambda route: route.abort())
    page = ctx.new_page()
    page.on('pageerror', lambda e: resultats.setdefault('__erreurs__', []).append(str(e)[:120]))

    for f in PAGES:
        try:
            page.goto(f'http://localhost:{PORT}/{f}', wait_until='networkidle', timeout=20000)
            page.wait_for_timeout(700)
            resultats[f] = page.evaluate(SONDE)
        except Exception as e:
            resultats[f] = {'erreur': str(e)[:150]}
    nav.close()
srv.shutdown()

print(json.dumps(resultats, ensure_ascii=False, indent=1))

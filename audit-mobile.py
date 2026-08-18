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
import http.server, socketserver, threading, functools, sys, os, json, socket, re

import audit_commun as commun

# ---------------------------------------------------------------------------
# PLAYWRIGHT : ABSENCE = ÉCHEC TECHNIQUE, PAS PLANTAGE
#
# `from playwright.sync_api import sync_playwright` en tête de fichier faisait
# tomber le script sur un `ModuleNotFoundError` avant même d'avoir affiché
# quoi que ce soit — une trace d'appels Python pour dire « il manque un
# paquet ». Et Chromium peut manquer alors que le paquet est installé : le
# message d'erreur de Playwright est alors encore moins parlant.
#
# L'import est donc différé, et les deux cas produisent une consigne
# d'installation exacte, avec un code de sortie 2 qui les distingue d'un
# dépôt sain.
# ---------------------------------------------------------------------------
def _charger_playwright():
    try:
        from playwright.sync_api import sync_playwright
        return sync_playwright
    except ImportError:
        raise commun.EchecTechnique(
            "Playwright n'est pas installé.\n\n"
            "  Cet audit mesure le débordement dans un vrai navigateur : il ne\n"
            "  peut pas s'exécuter sans lui, et NE DOIT PAS être considéré comme\n"
            "  réussi en son absence.\n\n"
            "      pip install playwright\n"
            "      python3 -m playwright install chromium\n\n"
            "  En intégration continue, ajoutez ces deux lignes avant l'audit.")


def _port_libre(prefere=8099):
    """Trouve un port disponible.

    Le port 8099 était figé. Deux audits lancés en parallèle — ou un serveur
    laissé ouvert par une exécution précédente interrompue — produisaient un
    `OSError: Address already in use` que rien ne rattrapait. On essaie le port
    habituel, puis on laisse le système en choisir un.
    """
    for candidat in (prefere, prefere + 1, prefere + 2):
        with socket.socket() as s:
            try:
                s.bind(('', candidat))
                return candidat
            except OSError:
                continue
    with socket.socket() as s:
        s.bind(('', 0))
        return s.getsockname()[1]


LARGEUR, HAUTEUR = 360, 780

class Silencieux(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass

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

def auditer_mobile(racine, pages_demandees=None):
    sync_playwright = _charger_playwright()

    pages = pages_demandees or [f for f in sorted(os.listdir(racine)) if f.endswith('.html')]
    if not pages:
        raise commun.EchecTechnique(
            f"Aucune page HTML dans {racine}.\n"
            f"  Vérifiez le chemin du dépôt frontend.")

    port = _port_libre()
    Handler = functools.partial(Silencieux, directory=racine)
    socketserver.TCPServer.allow_reuse_address = True
    srv = socketserver.TCPServer(("", port), Handler)
    threading.Thread(target=srv.serve_forever, daemon=True).start()

    rapport = commun.Rapport('mobile', depot='Scolaire-HTML-main', chemin_depot=racine)
    erreurs_page = []

    try:
        try:
            contexte_pw = sync_playwright().start()
        except Exception as e:
            raise commun.EchecTechnique(
                f"Playwright n'a pas pu démarrer : {e}\n\n"
                f"      python3 -m playwright install chromium")
        try:
            try:
                # Une image CI peut fournir Chromium à une version différente de
                # celle que Playwright attend par défaut : il le cherche alors à
                # un chemin qui n'existe pas et l'audit échoue en annonçant un
                # navigateur « absent » alors qu'il est installé. On préfère
                # celui qui est réellement présent quand il y en a un.
                import glob as _glob
                _fournis = sorted(_glob.glob('/opt/pw-browsers/chromium-*/chrome-linux/chrome'))
                if _fournis:
                    nav = contexte_pw.chromium.launch(
                        executable_path=_fournis[0], args=['--no-sandbox'])
                else:
                    nav = contexte_pw.chromium.launch()
            except Exception as e:
                raise commun.EchecTechnique(
                    f"Chromium est absent ou ne démarre pas : {str(e)[:200]}\n\n"
                    f"  Le paquet Playwright est installé mais pas son navigateur :\n"
                    f"      python3 -m playwright install chromium\n\n"
                    f"  Sur une machine sans interface, ajoutez aussi les bibliothèques :\n"
                    f"      python3 -m playwright install-deps chromium")

            ctx = nav.new_context(
                viewport={'width': LARGEUR, 'height': HAUTEUR},
                device_scale_factor=2, is_mobile=True, has_touch=True,
                user_agent='Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) '
                           'AppleWebKit/605.1.15 Mobile/15E148')
            ctx.add_init_script(SESSION)
            # Le backend n'existe pas ici : on répond du vide plutôt que d'attendre.
            def _repondre(route):
                """Réponse simulée du backend, de FORME plausible.

                Le simulateur répondait `{}` à tout. Les nombreuses pages qui
                font `(await r.json()).map(...)` sur une route de LISTE
                plantaient donc systématiquement — et l'audit signalait une
                « erreur JavaScript critique » sur du code parfaitement sain.
                Un audit qui invente des défauts fait perdre plus de temps
                qu'il n'en fait gagner.

                Heuristique volontairement simple : une route sans identifiant
                terminal renvoie une liste, sinon un objet. Elle ne prétend pas
                être exacte — elle évite juste de fabriquer de faux positifs.
                Les vraies incohérences de contrat sont l'affaire de
                `audit-contrat-api.py`, qui lit les deux dépôts.
                """
                chemin = route.request.url.split('?')[0].rstrip('/')
                dernier = chemin.split('/')[-1]
                ressemble_a_un_id = bool(re.match(r'^[0-9a-f-]{8,}$|^\d+$', dernier))
                corps = '{}' if ressemble_a_un_id else '[]'
                route.fulfill(status=200, content_type='application/json', body=corps)

            ctx.route('**://scolaire-saas-backend.onrender.com/**', _repondre)
            ctx.route('**://fonts.googleapis.com/**', lambda route: route.abort())
            ctx.route('**://fonts.gstatic.com/**', lambda route: route.abort())

            page = ctx.new_page()
            page.on('pageerror', lambda e: erreurs_page.append(str(e)[:160]))

            for f in pages:
                rapport.fichier_examine()
                erreurs_page.clear()
                try:
                    page.goto(f'http://localhost:{port}/{f}',
                              wait_until='networkidle', timeout=20000)
                    page.wait_for_timeout(700)
                    mesure = page.evaluate(SONDE)
                except Exception as e:
                    # Une page qui ne se charge pas EST une anomalie produit,
                    # pas un incident d'outillage : le serveur local répond, le
                    # navigateur fonctionne, c'est la page qui échoue.
                    rapport.constat(f, 'page_incharcheable',
                                    f"chargement impossible : {str(e)[:150]}",
                                    gravite='critique')
                    continue

                # --- Débordement horizontal : LA mesure qui compte -----------
                if mesure['scrollW'] > mesure['vw'] + 1:
                    depassement = mesure['scrollW'] - mesure['vw']
                    coupables = ', '.join(
                        f"{d['tag']}{('.' + d['cls'].split()[0]) if d['cls'] else ''}"
                        f"{('#' + d['id']) if d['id'] else ''} ({d['largeur']}px)"
                        for d in mesure['debord'][:3]) or 'élément non identifié'
                    rapport.constat(
                        f, 'debordement_horizontal',
                        f"déborde de {depassement}px à {LARGEUR}px de large — {coupables}",
                        gravite='importante' if depassement < 60 else 'critique',
                        contexte={'scrollW': mesure['scrollW'], 'debord': mesure['debord'][:5]})

                # --- Cibles tactiles trop petites ---------------------------
                if mesure.get('ciblesPetites', 0) > 0:
                    rapport.constat(
                        f, 'cible_tactile_petite',
                        f"{mesure['ciblesPetites']} cible(s) de moins de 36px de haut",
                        gravite='moyenne')

                if mesure.get('petitTexte', 0) > 0:
                    rapport.constat(
                        f, 'texte_illisible',
                        f"{mesure['petitTexte']} élément(s) sous 11,5px",
                        gravite='faible')

                for err in erreurs_page[:3]:
                    rapport.constat(f, 'erreur_javascript',
                                    f"exception au chargement : {err}", gravite='critique')

            nav.close()
        finally:
            contexte_pw.stop()
    finally:
        srv.shutdown()

    rapport.message = f"{len(pages)} page(s) mesurée(s) à {LARGEUR}px dans Chromium."
    return rapport


def main():
    p = commun.analyseur(__doc__, besoin_frontend=True)
    p.add_argument('pages', nargs='*', help='Pages précises (par défaut : toutes)')
    args = p.parse_args()

    positionnels = list(args.pages)
    racine = args.frontend
    if not racine and positionnels and os.path.isdir(positionnels[0]):
        racine, positionnels = positionnels[0], positionnels[1:]
    racine = commun.trouver_depot('frontend', racine, 'ARDOISE_FRONTEND')

    return commun.executer(lambda: auditer_mobile(racine, positionnels or None), args)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except commun.EchecTechnique as e:
        print("ÉCHEC TECHNIQUE — l'audit mobile n'a pas pu s'exécuter.\n")
        for ligne in str(e).split('\n'):
            print('  ' + ligne)
        print("\nCe n'est PAS un rapport de conformité : aucune page n'a été mesurée.")
        sys.exit(2)

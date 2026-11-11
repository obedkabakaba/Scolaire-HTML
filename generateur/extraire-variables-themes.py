"""Extrait des feuilles d'apparence (theme-*.css) les seuls blocs de VARIABLES
(`html[data-theme="x"] { --... }`), pour les espaces qui ont leur propre coque
(centre de formation) : ils suivent les couleurs, polices et arrondis de
l'apparence choisie sans hériter de ses habillages d'écran."""
import os, re
os.chdir('/home/user/Scolaire-HTML')
THEMES = ['elan', 'perspective', 'recre', 'nexus', 'orbite', 'fluide', 'vibra', 'pro', 'savane']
sortie = ['/* ==========================================================================',
          '   ARDOISE — VARIABLES DES APPARENCES (fichier généré)',
          '   Extrait des theme-*.css : seulement les blocs de variables. Chargé par',
          '   les espaces à coque propre (centre-formation.html). Régénérer avec',
          '   generateur/extraire-variables-themes.py après une modification d\'apparence.',
          '   ========================================================================== */']
for t in THEMES:
    css = open(f'theme-{t}.css').read()
    css = re.sub(r'/\*.*?\*/', '', css, flags=re.S)
    blocs = []
    for m in re.finditer(r'([^{}]+)\{([^{}]*)\}', css):
        sel = ' '.join(m.group(1).split())
        if not re.fullmatch(rf'html\[data-theme="{t}"\](\[data-theme="{t}"\])?', sel):
            continue
        decls = [d.strip() for d in m.group(2).split(';') if d.strip()]
        garder = [d for d in decls if d.startswith('--') or d.startswith('color-scheme')]
        if garder:
            blocs.append(f'html[data-theme="{t}"] {{ ' + '; '.join(garder) + '; }')
    sortie.append(f'/* {t} */')
    sortie.extend(blocs)
    print(t, len(blocs))
open('theme-variables.css', 'w').write('\n'.join(sortie) + '\n')

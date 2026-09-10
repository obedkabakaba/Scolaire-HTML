# Fluide

Apparence optionnelle dans **Mon profil → Apparence → Fluide**. Elle reprend la dernière maquette acceptée : verre transparent, reflets blancs, fond aquatique épuré, rail large à gauche, titre serif et raccourcis colorés à droite. Les autres rubriques reçoivent les surfaces et contrôles en verre, tout en conservant leurs formulaires et opérations. Le Super Admin garde son organisation particulière.

Les panneaux utilisent un fond blanc partiellement transparent et un flou de l'arrière-plan. Les fenêtres de dialogue gardent un fond plus opaque pour leur lisibilité. Un repli sans flou et le réglage système de réduction de transparence sont prévus. Les SVG de la vague et des quatre pictogrammes sont locaux et natifs ; aucun service d'images externe n'est appelé.

Les compteurs et le bloc notes/événements sont les nœuds d'origine, déplacés puis remis à leur emplacement en quittant Fluide, avec leurs écouteurs conservés. La restauration précède les autres gestionnaires d'apparence et l'installation suit leurs déplacements, notamment ceux d'Orbite Aube. Le thème n'émet aucune nouvelle requête métier et n'affiche aucun chiffre, taux de présence ou portrait fictif. L'effectif de l'équipe vient du compteur existant lorsqu'il est disponible.

Les quatre raccourcis sont limités aux pages disponibles dans le rail et autorisées par ArdoiseAcces. La recherche (bouton ou Ctrl/Cmd+K) porte sur les écrans disponibles, pas sur les dossiers individuels. Échap ferme la fenêtre. Les préférences de position sont conservées pour les thèmes compatibles ; Fluide garde sa disposition dédiée, avec un conteneur interne vertical même après une ancienne préférence haut/bas. Le tiroir mobile existant reste utilisé.

Le cache v78 inclut les scripts, styles et cinq SVG de Fluide. Le backend accepte la clé `fluide`.

## Vérifications

`node test-fluide-browser.cjs` : transparence et flou calculés, raccourcis, données réelles simulées des écrans, conservation des nœuds et de leurs clics, alternance avec Orbite et les autres thèmes, recherche, profil, quatre positions et deux modes compacts, menu mobile, rôle professeur et ressources hors connexion après migration du cache v77. Les coques de 32 écrans sont vérifiées à trois largeurs, ainsi que le Super Admin. Les compteurs et événements restent visibles à l'impression, sans les commandes ajoutées par Fluide. Les API sont simulées ; les opérations métier des coques ne sont pas exécutées.

`FLUIDE_BROWSER` sélectionne un Chromium installé et `FLUIDE_SHOT` le chemin des captures. Les tests des apparences précédentes et les audits existants restent exécutés par la CI.

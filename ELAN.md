# Élan

Apparence optionnelle disponible dans **Mon profil → Apparence → Élan**.

La barre horizontale réutilise les liens filtrés par rôle et leurs écouteurs.
Les positions enregistrées pour les autres thèmes ne sont pas modifiées.
Sur téléphone, le tiroir et la barre d’accès rapide existants sont conservés.

Les 33 rubriques applicatives sont décrites dans theme-elan.js. Leurs bandeaux,
les raccourcis et le tiroir utilisent 30 illustrations SVG locales. Le bandeau
d’accueil utilise une illustration éditoriale générée, exportée en WebP.
Les écrans imprimables de bulletin et le site public ne sont pas redessinés.

L’agenda montre le mois courant, permet de parcourir les mois et reprend les
événements du tableau de bord existant. Il ne crée pas de rendez-vous et ne
charge aucune donnée métier supplémentaire. Les indicateurs et graphiques
existants conservent leurs données : aucun chiffre de la maquette n’est injecté.

Le choix elan doit être autorisé dans controllers/utilisateurs.controller.js
du backend. Le cache frontend passe à v70 et précache les ressources Élan.

## Validation

La commande node test-elan-browser.cjs utilise Playwright et Chromium, avec
données API de test interceptées. ELAN_BROWSER permet de choisir un navigateur
installé ; ELAN_SHOT choisit le fichier de capture.

Le test exécute les vrais scripts de navigation, thème et mobile. Il vérifie
le tableau de bord avec données de test, le choix dans Mon profil, la persistance
après rechargement, le tiroir mobile, les quatre positions précédentes, 32 pages
à 1536 et 390 px et la coque Super Admin. Pour l’inventaire des pages, seuls les
scripts métier inline sont désactivés ; il ne remplace pas les tests de leurs
opérations serveur.

Audits complémentaires : audit-frontend.py, audit-cloisonnement-menus.py,
audit-autorisation-abonnements.py et les contrôles offline existants.

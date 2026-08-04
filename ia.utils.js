/**
 * Service IA partagé — Ardoise (version OpenAI)
 * --------------------------------------------------------------------------
 * Point d'entrée unique vers l'API OpenAI. Toutes les fonctionnalités IA
 * de la plateforme passent par ici, ce qui garantit trois choses :
 *
 *   1. Le quota mensuel est vérifié et décompté au même endroit ;
 *   2. Aucun nom d'élève ne part vers l'API (voir pseudonymisation) ;
 *   3. Un changement de modèle ou de fournisseur ne touche qu'un fichier.
 *
 * Variables d'environnement attendues sur Render :
 *   OPENAI_API_KEY     (obligatoire)
 *   OPENAI_MODEL       (facultatif — défaut : gpt-4o-mini)
 */

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const MODELE_DEFAUT = 'gpt-4o-mini';   // ou gpt-3.5-turbo
const QUOTA_DEFAUT = 300;              // appels par mois
const DELAI_MAX_MS = 45000;

/**
 * Remplace les identités par des étiquettes neutres avant l'envoi.
 * (inchangé)
 */
function pseudonymiser(eleves) {
  const table = new Map();
  const anonymes = eleves.map((eleve, index) => {
    const etiquette = `Élève ${index + 1}`;
    table.set(etiquette, eleve);
    const { nom, postnom, prenom, matricule, ...reste } = eleve;
    return { etiquette, ...reste };
  });
  return { anonymes, table };
}

/** Vérifie le quota du mois et le décompte (inchangé) */
async function consommerQuota(client, ecoleId, nbAppels) {
  const mois = new Date().toISOString().slice(0, 7);

  const planResult = await client.query(
    `SELECT COALESCE((p.fonctionnalites->>'ia_quota_mensuel')::int, $2) AS quota
     FROM abonnements a
     JOIN plans_abonnement p ON p.id = a.plan_id
     WHERE a.ecole_id = $1 AND a.statut = 'actif'
     ORDER BY a.created_at DESC LIMIT 1`,
    [ecoleId, QUOTA_DEFAUT]
  );
  const quota = planResult.rows[0] ? Number(planResult.rows[0].quota) : QUOTA_DEFAUT;

  const usageResult = await client.query(
    `INSERT INTO ia_utilisations (ecole_id, mois, nb_appels)
     VALUES ($1, $2, 0)
     ON CONFLICT (ecole_id, mois) DO UPDATE SET nb_appels = ia_utilisations.nb_appels
     RETURNING nb_appels`,
    [ecoleId, mois]
  );
  const dejaUtilise = Number(usageResult.rows[0].nb_appels);

  if (dejaUtilise + nbAppels > quota) {
    throw Object.assign(
      new Error(`Quota IA du mois atteint (${dejaUtilise}/${quota} générations). Il se réinitialise le 1er du mois prochain.`),
      { statusCode: 429 }
    );
  }

  await client.query(
    `UPDATE ia_utilisations SET nb_appels = nb_appels + $3, updated_at = now()
     WHERE ecole_id = $1 AND mois = $2`,
    [ecoleId, mois, nbAppels]
  );

  return { quota, utilise: dejaUtilise + nbAppels, restant: quota - dejaUtilise - nbAppels };
}

/** État du quota, sans rien consommer (inchangé) */
async function etatQuota(client, ecoleId) {
  const mois = new Date().toISOString().slice(0, 7);
  const planResult = await client.query(
    `SELECT COALESCE((p.fonctionnalites->>'ia_quota_mensuel')::int, $2) AS quota
     FROM abonnements a
     JOIN plans_abonnement p ON p.id = a.plan_id
     WHERE a.ecole_id = $1 AND a.statut = 'actif'
     ORDER BY a.created_at DESC LIMIT 1`,
    [ecoleId, QUOTA_DEFAUT]
  );
  const quota = planResult.rows[0] ? Number(planResult.rows[0].quota) : QUOTA_DEFAUT;

  const usageResult = await client.query(
    `SELECT nb_appels FROM ia_utilisations WHERE ecole_id = $1 AND mois = $2`,
    [ecoleId, mois]
  );
  const utilise = usageResult.rows[0] ? Number(usageResult.rows[0].nb_appels) : 0;

  return { quota, utilise, restant: Math.max(quota - utilise, 0), mois };
}

// ---------------------------------------------------------------------
// Appels à l'API OpenAI (nouveaux)
// ---------------------------------------------------------------------

/**
 * Appel brut à l'API OpenAI. Renvoie le texte de la réponse.
 * Ne consomme pas de quota : c'est à l'appelant de le faire.
 */

/**
 * Appel avec IMAGE — pour lire un document qu'on ne peut pas convertir en texte.
 *
 * POURQUOI CE CHEMIN EXISTE
 * -------------------------
 * Un modèle de bulletin scolaire est un OBJET VISUEL : la place de chaque
 * mention compte autant que son intitulé. Extraire son texte ne dit rien de sa
 * mise en page, et c'est précisément la mise en page qu'on veut reproduire.
 *
 * C'est aussi ce qui rend l'import « tous formats » réaliste : une école qui
 * n'a que du papier photographie son bulletin, et une école qui n'a qu'un PDF
 * en fait une capture d'écran. Aucune bibliothèque supplémentaire n'est
 * nécessaire.
 *
 * @param {Array<{base64: string, type: string}>} images
 */
async function appelerIAVision({ systeme, message, images, maxTokens = 2500 }) {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(
      new Error("L'assistant n'est pas configuré sur ce serveur (clé API absente)."),
      { statusCode: 503 }
    );
  }
  if (!Array.isArray(images) || images.length === 0) {
    throw Object.assign(new Error('Aucune image à analyser.'), { statusCode: 400 });
  }

  // Le modèle par défaut du projet (`gpt-4o-mini`) accepte les images. Si
  // l'exploitant a configuré un modèle sans vision, l'API renverra une erreur
  // explicite — mieux vaut cela qu'un silence ou une réponse inventée.
  const contenu = [{ type: 'text', text: message }];
  for (const img of images) {
    contenu.push({
      type: 'image_url',
      image_url: {
        url: `data:${img.type};base64,${img.base64}`,
        // « high » est nécessaire : en détail réduit, les petits libellés d'un
        // bulletin deviennent illisibles et le modèle invente des intitulés.
        detail: 'high'
      }
    });
  }

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MAX_MS);

  try {
    const reponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      signal: controleur.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL_VISION || process.env.OPENAI_MODEL || MODELE_DEFAUT,
        messages: [
          { role: 'system', content: systeme },
          { role: 'user', content: contenu }
        ],
        max_tokens: maxTokens
      })
    });

    if (!reponse.ok) {
      const detail = await reponse.text();
      console.error('Erreur API OpenAI (vision):', reponse.status, detail.slice(0, 400));
      throw Object.assign(
        new Error(
          reponse.status === 400
            ? "Le modèle d'IA configuré ne sait pas lire les images. Renseignez OPENAI_MODEL_VISION "
              + "avec un modèle qui le permet, ou importez le modèle sous forme de document texte."
            : "L'assistant est momentanément indisponible. Réessayez dans quelques instants."
        ),
        { statusCode: 502 }
      );
    }

    const donnees = await reponse.json();
    const choix = donnees.choices && donnees.choices[0];
    if (!choix) throw new Error("Réponse inattendue de l'API OpenAI");
    return choix.message.content.trim();
  } finally {
    clearTimeout(minuterie);
  }
}

async function appelerIA({ systeme, message, maxTokens = 1500 }) {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(
      new Error("L'assistant n'est pas configuré sur ce serveur (clé API absente)."),
      { statusCode: 503 }
    );
  }

  const messages = [
    { role: 'system', content: systeme },
    { role: 'user', content: message }
  ];

  const controleur = new AbortController();
  const minuterie = setTimeout(() => controleur.abort(), DELAI_MAX_MS);

  try {
    const reponse = await fetch(OPENAI_API_URL, {
      method: 'POST',
      signal: controleur.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || MODELE_DEFAUT,
        messages,
        max_tokens: maxTokens,
      })
    });

    if (!reponse.ok) {
      const detail = await reponse.text();
      console.error('Erreur API OpenAI:', reponse.status, detail.slice(0, 400));
      throw Object.assign(
        new Error("L'assistant est momentanément indisponible. Réessayez dans quelques instants."),
        { statusCode: 502 }
      );
    }

    const donnees = await reponse.json();
    const choix = donnees.choices && donnees.choices[0];
    if (!choix) {
      throw new Error('Réponse inattendue de l\'API OpenAI');
    }
    return choix.message.content.trim();
  } catch (err) {
    if (err.name === 'AbortError') {
      throw Object.assign(
        new Error("L'assistant a mis trop de temps à répondre. Réessayez avec moins d'élèves à la fois."),
        { statusCode: 504 }
      );
    }
    throw err;
  } finally {
    clearTimeout(minuterie);
  }
}

/**
 * Appel attendant du JSON en retour.
 */
async function appelerIAJson({ systeme, message, maxTokens = 2000 }) {
  const brut = await appelerIA({ systeme, message, maxTokens });
  const nettoye = brut.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();

  try {
    return JSON.parse(nettoye);
  } catch (e) {
    const debut = nettoye.search(/[[{]/);
    const fin = Math.max(nettoye.lastIndexOf(']'), nettoye.lastIndexOf('}'));
    if (debut !== -1 && fin > debut) {
      try { return JSON.parse(nettoye.slice(debut, fin + 1)); } catch (e2) { /* abandon */ }
    }
    console.error('Réponse IA non analysable:', nettoye.slice(0, 300));
    throw Object.assign(
      new Error("La réponse de l'assistant n'a pas pu être interprétée. Réessayez."),
      { statusCode: 502 }
    );
  }
}

/**
 * Conversion d'un outil au format Anthropic vers le format OpenAI.
 */
function outilAnthropicVersOpenAI(outilAnthropic) {
  return {
    type: 'function',
    function: {
      name: outilAnthropic.name,
      description: outilAnthropic.description,
      parameters: outilAnthropic.input_schema,
    }
  };
}

/**
 * Conversation avec outils (version OpenAI).
 *
 * Le modèle ne lit jamais la base : il demande l'exécution d'un outil, que
 * NOUS exécutons avec les droits et le périmètre que nous décidons.
 *
 * @param {object} p
 * @param {string} p.systeme
 * @param {Array}  p.messages       historique { role, content } (rôles 'user' ou 'assistant')
 * @param {Array}  p.outils         définitions d'outils au format Anthropic
 * @param {Function} p.executerOutil  (nom, entree) => Promise<any>
 * @param {number} p.toursMax       nombre d'allers-retours autorisés
 */
async function conversationAvecOutils({ systeme, messages, outils, executerOutil, toursMax = 4, maxTokens = 1200 }) {
  if (!process.env.OPENAI_API_KEY) {
    throw Object.assign(new Error("Assistant non configuré (clé API absente)."), { statusCode: 503 });
  }

  // Convertir les outils au format OpenAI
  const outilsOpenAI = outils.map(outilAnthropicVersOpenAI);

  // Construire l'historique des messages (le système est ajouté en tête)
  const historique = [{ role: 'system', content: systeme }, ...messages];
  let outilsAppeles = [];

  for (let tour = 0; tour < toursMax; tour++) {
    const controleur = new AbortController();
    const minuterie = setTimeout(() => controleur.abort(), DELAI_MAX_MS);

    let donnees;
    try {
      const reponse = await fetch(OPENAI_API_URL, {
        method: 'POST',
        signal: controleur.signal,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || MODELE_DEFAUT,
          messages: historique,
          tools: outilsOpenAI,
          tool_choice: 'auto',
          max_tokens: maxTokens,
        })
      });

      if (!reponse.ok) {
        const detail = await reponse.text();
        console.error('Erreur API OpenAI (outils):', reponse.status, detail.slice(0, 400));
        throw Object.assign(new Error("Assistant momentanément indisponible."), { statusCode: 502 });
      }
      donnees = await reponse.json();
    } finally {
      clearTimeout(minuterie);
    }

    const choix = donnees.choices && donnees.choices[0];
    if (!choix) {
      throw new Error('Réponse inattendue d\'OpenAI');
    }

    const messageAssistant = choix.message;

    // Ajouter le message de l'assistant à l'historique
    historique.push({
      role: 'assistant',
      content: messageAssistant.content || null,
      tool_calls: messageAssistant.tool_calls || undefined,
    });

    // Si l'assistant demande d'appeler des outils
    if (messageAssistant.tool_calls && messageAssistant.tool_calls.length > 0) {
      const toolResults = [];
      for (const toolCall of messageAssistant.tool_calls) {
        const nomOutil = toolCall.function.name;
        outilsAppeles.push(nomOutil);
        let args = {};
        try {
          args = JSON.parse(toolCall.function.arguments);
        } catch (e) {
          console.error('Erreur parsing arguments outil:', e);
          args = {};
        }

        let contenu;
        try {
          const valeur = await executerOutil(nomOutil, args);
          contenu = JSON.stringify(valeur);
        } catch (e) {
          contenu = JSON.stringify({ erreur: e.message || 'Outil indisponible.' });
        }

        toolResults.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: contenu,
        });
      }

      // Ajouter les résultats des outils à l'historique
      historique.push(...toolResults);
      // Continuer la boucle pour que le modèle génère la réponse finale
      continue;
    }

    // Si l'assistant a fourni une réponse texte (pas d'appel d'outil)
    const texte = messageAssistant.content || "Je n'ai pas bien saisi votre demande. Reformulez.";
    return { texte, outilsAppeles };
  }

  // Si on a fait trop de tours sans réponse finale
  return {
    texte: "Je n'ai pas réussi à aboutir. Reformulez votre question, ou contactez directement l'école.",
    outilsAppeles
  };
}

module.exports = {
  appelerIA,
  conversationAvecOutils,
  appelerIAJson,
  pseudonymiser,
  consommerQuota,
  etatQuota,
  appelerIAVision,
  MODELE_DEFAUT
};

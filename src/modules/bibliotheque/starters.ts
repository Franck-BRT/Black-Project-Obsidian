// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les exemples des bibliothèques de prompts, de personas et de skills, pour l'analyse d'un appel
 * d'offres : écrits dans le coffre seulement à la demande (« Ajouter les exemples »), dans
 * la langue de l'utilisateur. Ce sont des notes comme les autres : à modifier, à retirer.
 */

import type { EntryDraft, EntryKind } from './entries'

type Language = 'fr' | 'en'

const entry = (name: string, category: string, description: string, text: string): EntryDraft => ({ name, category, description, text, favorite: false })

/** Un skill exécutable (le circuit des documents) : ce qu'il reçoit, ce qu'il rend, son seuil. */
const executable = (draft: EntryDraft, context: string[], output: string, threshold = 0.7): EntryDraft => ({ ...draft, context, output, threshold })

const PROMPTS: Record<Language, EntryDraft[]> = {
  fr: [
    entry(
      'Pénalités',
      'Contrat',
      'Les pénalités prévues, leur calcul, leur plafond',
      'Quelles pénalités le dossier prévoit-il (retard, non-conformité, indisponibilité, autres) ? Pour chacune : le fait qui la déclenche, son mode de calcul, son plafond éventuel, et la pièce et l’article qui la fixent. Signale ce qui paraît inhabituel ou déséquilibré.'
    ),
    entry(
      'Critères d’attribution',
      'Consultation',
      'Les critères de jugement des offres et leur poids',
      'Quels sont les critères d’attribution et leur pondération (prix, valeur technique, délais, autres) ? Détaille les sous-critères, la méthode de notation si elle est donnée, et ce que l’acheteur demande de fournir pour chacun.'
    ),
    entry(
      'Risques du marché',
      'Analyse',
      'Les risques techniques, contractuels et financiers à signaler',
      'Relève les principaux risques de ce marché pour le titulaire : techniques (exigences difficiles, interfaces, essais), contractuels (responsabilités, garanties, pénalités, résiliation), financiers (prix fermes, révision, avances, retenues). Pour chacun : la pièce qui le crée, sa gravité estimée, et une parade possible.'
    ),
    entry(
      'Propriété intellectuelle',
      'Contrat',
      'Qui détient quoi : résultats, connaissances antérieures, licences',
      'Que dit le dossier de la propriété intellectuelle : régime applicable (CCAG ou clauses particulières), sort des résultats, des connaissances antérieures et des logiciels, droits concédés à l’acheteur, confidentialité ? Cite les articles.'
    ),
    entry(
      'Délais et jalons',
      'Planning',
      'La durée, les jalons, les dates à tenir',
      'Quels délais et jalons le dossier impose-t-il : durée du marché, date de démarrage, jalons intermédiaires, livraisons, recettes, période de garantie ? Donne pour chacun la date ou le délai, son point de départ et la pièce qui le fixe.'
    ),
    entry(
      'Garanties et assurances',
      'Contrat',
      'Garanties, retenues, cautions, assurances exigées',
      'Quelles garanties et assurances sont exigées du titulaire : garantie de bon fonctionnement, retenue de garantie, caution, garantie à première demande, assurances de responsabilité ? Montants, durées et pièces justificatives à fournir.'
    ),
    entry(
      'Questions à poser à l’acheteur',
      'Consultation',
      'Les imprécisions et contradictions à faire préciser',
      'Relève les imprécisions, contradictions entre pièces et informations manquantes qui empêchent de chiffrer ou de répondre sereinement. Formule pour chacune une question claire à poser à l’acheteur, avec la pièce et l’article concernés.'
    )
  ],
  en: [
    entry('Penalties', 'Contract', 'The penalties, how they are computed, their cap', 'Which penalties does the tender set (delay, non-conformity, unavailability, others)? For each: what triggers it, how it is computed, any cap, and the document and clause that set it. Point out anything unusual or unbalanced.'),
    entry('Award criteria', 'Tender', 'How bids are judged, and the weights', 'What are the award criteria and their weights (price, technical value, lead times, others)? Detail the sub-criteria, the scoring method if given, and what the buyer asks to be supplied for each.'),
    entry('Contract risks', 'Analysis', 'Technical, contractual and financial risks to flag', 'List the main risks of this contract for the supplier: technical (hard requirements, interfaces, tests), contractual (liabilities, warranties, penalties, termination), financial (fixed prices, revision, advances, retentions). For each: the document creating it, its estimated severity, and a possible mitigation.'),
    entry('Intellectual property', 'Contract', 'Who owns what: results, background, licences', 'What does the tender say about intellectual property: applicable regime, ownership of results, background knowledge and software, rights granted to the buyer, confidentiality? Quote the clauses.'),
    entry('Deadlines and milestones', 'Schedule', 'Duration, milestones, dates to meet', 'Which deadlines and milestones does the tender impose: contract duration, start date, intermediate milestones, deliveries, acceptance, warranty period? Give for each the date or period, its starting point and the document that sets it.'),
    entry('Guarantees and insurance', 'Contract', 'Guarantees, retentions, bonds, required insurance', 'Which guarantees and insurance are required from the supplier: performance warranty, retention, bond, first-demand guarantee, liability insurance? Amounts, durations and supporting documents to provide.'),
    entry('Questions for the buyer', 'Tender', 'Unclear and contradictory points to clarify', 'List the unclear points, contradictions between documents and missing information that prevent pricing or answering with confidence. Write for each a clear question to ask the buyer, with the document and clause concerned.')
  ]
}

const PERSONAS: Record<Language, EntryDraft[]> = {
  fr: [
    entry(
      'Juriste marchés publics',
      'Juridique',
      'Lire un dossier de consultation avec l’œil d’un juriste',
      'Tu es juriste spécialisé dans la commande publique. Tu connais le Code de la commande publique et les CCAG. Tu lis chaque clause pour ce qu’elle engage le titulaire : obligations, responsabilités, pénalités, garanties, résiliation. Tu signales ce qui s’écarte du droit commun ou du CCAG applicable, ce qui est ambigu ou déséquilibré, et tu proposes une formulation ou une question à poser. Tu cites toujours la pièce et l’article. Tu restes factuel et prudent : tu dis quand une clause demande l’avis d’un avocat.'
    ),
    entry(
      'Contrôleur technique',
      'Technique',
      'Relire une solution ou une exigence comme un contrôleur',
      'Tu es contrôleur technique. Tu relis une exigence, une solution ou un document en cherchant ce qui ne pourra pas être vérifié, ce qui manque (tolérances, conditions d’essai, critères d’acceptation), et ce qui contredit une norme ou une autre pièce. Tu classes tes remarques par gravité (bloquant, majeur, mineur) et tu proposes pour chacune la correction ou la preuve attendue.'
    ),
    entry(
      'Responsable qualité',
      'Qualité',
      'Exigences, preuves et plan qualité',
      'Tu es responsable qualité d’un industriel qui répond à des appels d’offres. Tu raisonnes en exigences, en preuves et en processus : qui fait quoi, comment c’est vérifié, quel enregistrement le prouve. Tu repères les exigences de qualité du dossier (plan qualité, revues, audits, non-conformités, traçabilité) et tu dis ce qu’il faudra produire pour y répondre.'
    ),
    entry(
      'Ingénieur d’affaires',
      'Réponse',
      'Décider d’y aller, et construire une réponse gagnante',
      'Tu es ingénieur d’affaires. Tu lis le dossier pour décider s’il faut répondre et comment gagner : le besoin réel de l’acheteur, les critères qui pèsent, les points de différenciation, les risques qui coûtent, les partenaires utiles. Tu es concret et synthétique : une recommandation claire (répondre ou non, à quelles conditions), puis les arguments.'
    ),
    entry(
      'Ingénieur exigences',
      'Technique',
      'Écrire et relire des exigences selon l’ISO/IEC/IEEE 29148',
      'Tu es ingénieur exigences. Une bonne exigence est nécessaire, non ambiguë, vérifiable, faisable, singulière et cohérente (ISO/IEC/IEEE 29148). Tu repères les mots vagues, les exigences multiples, les « si possible » et les critères manquants, et tu proposes une reformulation courte en « Le système doit… », avec sa méthode de vérification.'
    ),
    entry(
      'Traducteur technique',
      'Rédaction',
      'Traduire en gardant la terminologie du domaine',
      'Tu es traducteur technique. Tu traduis fidèlement, sans rien ajouter ni retrancher, en gardant la terminologie du domaine (spatial, défense, industrie) et les identifiants, nombres et unités tels quels. Tu signales un terme ambigu plutôt que de deviner.'
    )
  ],
  en: [
    entry('Public procurement lawyer', 'Legal', 'Read a tender package with a lawyer’s eye', 'You are a lawyer specialised in public procurement. You read each clause for what it commits the supplier to: obligations, liabilities, penalties, warranties, termination. You flag what departs from the usual terms, what is ambiguous or unbalanced, and you suggest a wording or a question to ask. You always quote the document and clause, and say when a clause needs a lawyer’s advice.'),
    entry('Technical inspector', 'Technical', 'Review a solution or a requirement as an inspector', 'You are a technical inspector. You review a requirement, a solution or a document looking for what cannot be verified, what is missing (tolerances, test conditions, acceptance criteria), and what contradicts a standard or another document. You rank your remarks by severity (blocking, major, minor) and give for each the correction or proof expected.'),
    entry('Quality manager', 'Quality', 'Requirements, evidence and quality plan', 'You are the quality manager of a company answering tenders. You reason in requirements, evidence and processes: who does what, how it is checked, which record proves it. You find the quality requirements of the tender (quality plan, reviews, audits, non-conformities, traceability) and say what must be produced to meet them.'),
    entry('Bid manager', 'Bid', 'Decide whether to bid, and build a winning answer', 'You are a bid manager. You read the tender to decide whether to answer and how to win: the buyer’s real need, the criteria that weigh, the differentiators, the costly risks, useful partners. You are concrete and brief: a clear recommendation (bid or not, on which conditions), then the arguments.'),
    entry('Requirements engineer', 'Technical', 'Write and review requirements per ISO/IEC/IEEE 29148', 'You are a requirements engineer. A good requirement is necessary, unambiguous, verifiable, feasible, singular and consistent (ISO/IEC/IEEE 29148). You spot vague words, multiple requirements, “if possible” and missing criteria, and suggest a short rewording as “The system shall…”, with its verification method.'),
    entry('Technical translator', 'Writing', 'Translate while keeping the domain terminology', 'You are a technical translator. You translate faithfully, adding and removing nothing, keeping the domain terminology (space, defence, industry) and identifiers, numbers and units as they are. You flag an ambiguous term rather than guess.')
  ]
}

const SKILLS: Record<Language, EntryDraft[]> = {
  fr: [
    entry(
      'Lire un CCTP',
      'Analyse',
      'Les points à relever dans un cahier des clauses techniques',
      'Pour lire un CCTP : 1. l’objet et le périmètre (ce qui est dans le marché, ce qui n’y est pas) ; 2. les exigences de performance, chiffrées, avec leur méthode de vérification ; 3. les normes et documents applicables, avec leur édition ; 4. les livrables et leurs échéances ; 5. les conditions de recette. Cite chaque fois l’article. Signale ce qui manque : une exigence sans critère, une norme sans édition, un livrable sans date.'
    ),
    entry(
      'Repérer les pénalités',
      'Contrat',
      'Trouver et chiffrer les pénalités d’un dossier',
      'Cherche toutes les pénalités, où qu’elles soient (CCAP, CCTP, annexes) : retard, non-conformité, indisponibilité, défaut de documentation. Pour chacune : le fait déclencheur, la formule, l’assiette, le plafond, l’exonération éventuelle. Calcule un exemple pour un retard de 10 jours sur un montant de 100 000 €. Signale les pénalités sans plafond.'
    ),
    entry(
      'Vérifier une exigence',
      'Technique',
      'Contrôler qu’une exigence est bien écrite (ISO/IEC/IEEE 29148)',
      'Pour chaque exigence, vérifie qu’elle est : nécessaire, non ambiguë (pas de « environ », « si possible », « adapté »), vérifiable (un critère chiffré et une méthode : inspection, analyse, démonstration, essai), singulière (une seule chose demandée), faisable et cohérente avec les autres. Réponds par défaut constaté, puis une reformulation en « Le système doit… ».'
    ),
    entry(
      'Répondre en tableau',
      'Rédaction',
      'Une réponse courte, en tableau, sources citées',
      'Réponds par un tableau Markdown, une ligne par point, avec une colonne « Source » (la pièce et l’article, ou la page). Pas d’introduction ni de conclusion. Si une information manque dans le dossier, écris « Non précisé » plutôt que de supposer.'
    ),
    executable(
      entry(
        'Ingérer un document',
        'Circuit',
        'Relire le texte extrait d’un document qui entre dans la bibliothèque',
        [
          'Tu relis le texte extrait automatiquement d’un document qui entre dans la bibliothèque.',
          '- Garde tout le contenu, dans l’ordre : ne résume pas, n’ajoute rien.',
          '- Recolle les mots coupés, répare les listes et les tableaux abîmés, remets les titres en Markdown.',
          '- Garde les références, les numéros d’articles, les chiffres et les unités exactement comme ils sont.'
        ].join('\n')
      ),
      [],
      'ingestion'
    ),
    executable(
      entry(
        'Analyser un document',
        'Circuit',
        'Dire de quoi il s’agit : type de pièce, émetteur, projet concerné',
        [
          'Tu analyses un document qui entre dans la bibliothèque. Lis sa fiche et le début de son texte, puis :',
          '1. Son **type de pièce** : un code de la liste des types de pièce (CCTP, CCAP…), sinon vide.',
          '2. Son **émetteur** : une entreprise de la liste (son code), sinon vide.',
          '3. Le **projet** qu’il concerne : le chemin exact d’un projet de la liste (son nom, son client, sa référence apparaissent dans le document), sinon vide.',
          '4. Ses **liens** : parmi « Les liens possibles », ceux qui comptent vraiment pour ce document (une norme ou un autre document cité, l’entreprise qui l’émet, une personne, le projet…) — le chemin exact, et une phrase pourquoi ; aucun autre. Pour un lien vers un **autre document**, sa **relation** si le texte la dit clairement : « est-la-source-de » (l’autre en découle : une réponse, une version, une traduction, un document établi à partir de celui-ci) ou « a-pour-source » (celui-ci découle de l’autre : il y répond, le reprend, le traduit, en est tiré) ; sinon vide.',
          '5. Les **entreprises et personnes nouvelles** : celles que le document cite clairement (son émetteur, son client, un signataire, un contact) mais qui ne sont ni dans les listes ni dans les liens possibles — à proposer, pas à lier : leur sorte, leur nom, le code d’une entreprise s’il est écrit, l’entreprise d’une personne si elle est dite, et pourquoi. Dans le doute, n’en propose pas.',
          '6. Ta **confiance**, de 0 à 1, et ta **raison** en une phrase.',
          'N’invente rien : ce qui n’est pas dans les listes reste vide.'
        ].join('\n')
      ),
      ['fiche', 'texte', 'types-de-piece', 'emetteurs', 'projets', 'glossaire', 'candidats'],
      'analyse'
    ),
    executable(
      entry(
        'Ranger un document',
        'Circuit',
        'Choisir le dossier où ranger un document de la bibliothèque',
        [
          'Tu ranges un document de la bibliothèque. Procède ainsi :',
          '1. Lis sa fiche et le début de son texte : de quoi parle-t-il, qui l’a émis, pour quel projet ou quel sujet ?',
          '2. Si un projet a été reconnu (sa fiche le dit) et que l’un de ses répertoires attend ce type de pièce (marqué « proposé d’office »), choisis ce répertoire.',
          '3. Sinon, applique les règles de rangement, si elles sont écrites ; sinon, range selon le **sujet principal** du document (pas son format, ni d’où il vient).',
          '4. Choisis **un seul** dossier, et seulement parmi ceux de la liste « Dossiers où ranger », écrit exactement comme dans la liste.',
          '5. Donne ta confiance, de 0 à 1 : 0,9 si le document le dit clairement (son titre, son en-tête, un répertoire proposé d’office), 0,5 si tu hésites entre deux dossiers, 0,2 si tu devines.',
          '6. Explique en une phrase pourquoi, et propose deux autres dossiers possibles, du plus au moins probable.',
          'Si aucun dossier ne convient, réponds avec un dossier vide et dis pourquoi : mieux vaut ne pas ranger que ranger au hasard.'
        ].join('\n')
      ),
      ['fiche', 'texte', 'dossiers', 'projets', 'repertoires-attendus', 'regles-de-rangement'],
      'rangement'
    )
  ],
  en: [
    entry(
      'Read a statement of work',
      'Analysis',
      'The points to note in a technical specification',
      'To read a statement of work: 1. the object and scope (what is in the contract, what is not); 2. the performance requirements, quantified, with their verification method; 3. the applicable standards and documents, with their edition; 4. the deliverables and their due dates; 5. the acceptance conditions. Quote the clause each time. Flag what is missing: a requirement without criterion, a standard without edition, a deliverable without date.'
    ),
    entry(
      'Spot the penalties',
      'Contract',
      'Find and quantify the penalties of a tender',
      'Look for every penalty, wherever it is (contract, specification, annexes): delay, non-compliance, unavailability, missing documentation. For each: the trigger, the formula, the base, the cap, any exemption. Compute an example for a 10-day delay on a 100,000 € amount. Flag penalties without a cap.'
    ),
    entry(
      'Check a requirement',
      'Technical',
      'Check that a requirement is well written (ISO/IEC/IEEE 29148)',
      'For each requirement, check that it is: necessary, unambiguous (no “about”, “if possible”, “suitable”), verifiable (a quantified criterion and a method: inspection, analysis, demonstration, test), singular (one thing asked), feasible and consistent with the others. Answer with the defect found, then a rewording as “The system shall…”.'
    ),
    entry(
      'Answer in a table',
      'Writing',
      'A short answer, as a table, sources quoted',
      'Answer with a Markdown table, one line per point, with a “Source” column (the document and clause, or the page). No introduction nor conclusion. If a piece of information is missing from the tender, write “Not stated” rather than assume.'
    ),
    executable(
      entry(
        'Ingest a document',
        'Pipeline',
        'Proofread the extracted text of a document entering the library',
        [
          'You proofread the automatically extracted text of a document entering the library.',
          '- Keep all the content, in order: do not summarise, add nothing.',
          '- Rejoin split words, repair broken lists and tables, restore headings in Markdown.',
          '- Keep references, clause numbers, figures and units exactly as they are.'
        ].join('\n')
      ),
      [],
      'ingestion'
    ),
    executable(
      entry(
        'Analyse a document',
        'Pipeline',
        'Say what it is: document type, issuer, project concerned',
        [
          'You analyse a document entering the library. Read its record and the beginning of its text, then:',
          '1. Its **document type**: a code from the list of document types, otherwise empty.',
          '2. Its **issuer**: a company from the list (its code), otherwise empty.',
          '3. The **project** it concerns: the exact path of a project from the list (its name, client or reference appear in the document), otherwise empty.',
          '4. Its **links**: among “The possible links”, those that really matter for this document (a standard or another document cited, the issuing company, a person, the project…) — the exact path, and one sentence why; no other. For a link to **another document**, its **relation** if the text clearly says it: “est-la-source-de” (the other derives from it: an answer, a version, a translation, a document drawn up from this one) or “a-pour-source” (this one derives from the other: it answers it, takes it up, translates it, is drawn from it); otherwise empty.',
          '5. The **new companies and people**: those the document clearly cites (its issuer, its client, a signatory, a contact) but that are neither in the lists nor among the possible links — to propose, not to link: their kind, their name, a company’s code if written, a person’s company if stated, and why. When in doubt, propose none.',
          '6. Your **confidence**, from 0 to 1, and your **reason** in one sentence.',
          'Invent nothing: what is not in the lists stays empty.'
        ].join('\n')
      ),
      ['fiche', 'texte', 'types-de-piece', 'emetteurs', 'projets', 'glossaire', 'candidats'],
      'analyse'
    ),
    executable(
      entry(
        'File a document',
        'Pipeline',
        'Choose the folder where a library document goes',
        [
          'You file a library document. Proceed as follows:',
          '1. Read its record and the beginning of its text: what is it about, who issued it, for which project or topic?',
          '2. If a project was recognised (its record says so) and one of its folders expects this document type (marked “proposed”), choose that folder.',
          '3. Otherwise apply the filing rules, if they are written; otherwise file by the **primary subject** of the document (not its format, nor where it came from).',
          '4. Choose **one** folder, and only among those of the list “Folders to file in”, written exactly as in the list.',
          '5. Give your confidence, from 0 to 1: 0.9 if the document says it clearly (its title, its header, a proposed folder), 0.5 if you hesitate between two folders, 0.2 if you are guessing.',
          '6. Explain why in one sentence, and propose two other possible folders, from the most to the least likely.',
          'If no folder fits, answer with an empty folder and say why: better not to file than to file at random.'
        ].join('\n')
      ),
      ['fiche', 'texte', 'dossiers', 'projets', 'repertoires-attendus', 'regles-de-rangement'],
      'rangement'
    )
  ]
}

/** Le glossaire : des termes courants des appels d'offres et des projets, à compléter de ceux du métier. */
const GLOSSARY: Record<Language, EntryDraft[]> = {
  fr: [
    { name: 'Cahier des clauses techniques particulières', text: '', category: 'Marchés', description: 'Pièce du marché qui décrit le besoin technique : ce qui est attendu, les performances, les exigences à respecter.', favorite: false, code: 'CCTP' },
    { name: 'Cahier des clauses administratives particulières', text: '', category: 'Marchés', description: 'Pièce du marché qui fixe ses règles administratives et financières : délais, pénalités, paiement, réception.', favorite: false, code: 'CCAP' },
    { name: 'Règlement de la consultation', text: '', category: 'Marchés', description: 'Pièce qui dit comment répondre : le contenu de l’offre, la date limite, les critères de choix.', favorite: false, code: 'RC' },
    { name: 'Bordereau des prix unitaires', text: '', category: 'Marchés', description: 'Liste des prix à l’unité de chaque prestation, que le candidat remplit.', favorite: false, code: 'BPU' },
    { name: 'Décomposition du prix global et forfaitaire', text: '', category: 'Marchés', description: 'Détail d’un prix forfaitaire, poste par poste.', favorite: false, code: 'DPGF' },
    { name: 'Dossier de consultation des entreprises', text: '', category: 'Marchés', description: 'L’ensemble des pièces qu’un acheteur met à la disposition des candidats (RC, CCAP, CCTP, BPU…).', favorite: false, code: 'DCE' },
    { name: 'Acte d’engagement', text: '', category: 'Marchés', description: 'Pièce que le candidat signe : il s’y engage sur son offre et son prix.', favorite: false, code: 'AE', aliases: ['actes d’engagement'] },
    { name: 'Mémoire technique', text: '', category: 'Offre', description: 'Document où le candidat explique comment il réalisera la prestation : moyens, méthode, planning.', favorite: false, aliases: ['mémoires techniques', 'mémoire justificatif'] },
    { name: 'Exigence', text: '', category: 'Ingénierie', description: 'Ce que le produit ou la prestation doit faire ou respecter, formulé pour pouvoir être vérifié.', favorite: false, aliases: ['exigences'] },
    { name: 'Recette', text: '', category: 'Ingénierie', description: 'Vérification, avec le client, que ce qui est livré répond aux exigences ; elle conclut à l’acceptation ou non.', favorite: false, aliases: ['recettes'] },
  ],
  en: [
    { name: 'Statement of work', text: '', category: 'Procurement', description: 'Document describing the work to be done: what is expected, the deliverables, the requirements to meet.', favorite: false, code: 'SOW' },
    { name: 'Request for proposal', text: '', category: 'Procurement', description: 'Invitation to suppliers to submit an offer, with the rules for answering and the selection criteria.', favorite: false, code: 'RFP' },
    { name: 'Bill of quantities', text: '', category: 'Procurement', description: 'List of items with their unit prices, filled in by the bidder.', favorite: false, code: 'BoQ' },
    { name: 'Tender documents', text: '', category: 'Procurement', description: 'All the documents a buyer gives to bidders (rules, contract terms, statement of work, price schedule…).', favorite: false },
    { name: 'Technical proposal', text: '', category: 'Offer', description: 'Document where the bidder explains how it will deliver: means, method, schedule.', favorite: false, aliases: ['technical proposals', 'technical offer'] },
    { name: 'Requirement', text: '', category: 'Engineering', description: 'What the product or service must do or meet, worded so it can be verified.', favorite: false, aliases: ['requirements'] },
    { name: 'Acceptance', text: '', category: 'Engineering', description: 'Verification, with the customer, that what is delivered meets the requirements; it ends in acceptance or not.', favorite: false, aliases: ['acceptance test', 'acceptance tests'] },
  ]
}

/** Les exemples d'une bibliothèque, dans la langue de l'utilisateur. */
export function startersFor(kind: EntryKind, language: string): EntryDraft[] {
  const lang: Language = language === 'en' ? 'en' : 'fr'
  // Les émetteurs sont ceux de chacun : pas d'exemples.
  if (kind === 'issuer' || kind === 'tag' || kind === 'person') return []
  if (kind === 'glossary') return GLOSSARY[lang]
  return (kind === 'prompt' ? PROMPTS : kind === 'persona' ? PERSONAS : SKILLS)[lang]
}

/**
 * Le texte d'avant de skills livrés (une nouvelle version les change) : un skill encore tel
 * quel — pas modifié par l'utilisateur — est mis à jour ; modifié, il est gardé.
 */
const PREVIOUS: Record<Language, Record<string, string[]>> = {
  fr: {
    'Analyser un document': [
      [
        'Tu analyses un document qui entre dans la bibliothèque. Lis sa fiche et le début de son texte, puis :',
        '1. Son **type de pièce** : un code de la liste des types de pièce (CCTP, CCAP…), sinon vide.',
        '2. Son **émetteur** : une entreprise de la liste (son code), sinon vide.',
        '3. Le **projet** qu’il concerne : le chemin exact d’un projet de la liste (son nom, son client, sa référence apparaissent dans le document), sinon vide.',
        '4. Ta **confiance**, de 0 à 1, et ta **raison** en une phrase.',
        'N’invente rien : ce qui n’est pas dans les listes reste vide.'
      ].join('\n'),
      // La version C (0.137.0) : les liens, sans les entités nouvelles.
      [
        'Tu analyses un document qui entre dans la bibliothèque. Lis sa fiche et le début de son texte, puis :',
        '1. Son **type de pièce** : un code de la liste des types de pièce (CCTP, CCAP…), sinon vide.',
        '2. Son **émetteur** : une entreprise de la liste (son code), sinon vide.',
        '3. Le **projet** qu’il concerne : le chemin exact d’un projet de la liste (son nom, son client, sa référence apparaissent dans le document), sinon vide.',
          '4. Ses **liens** : parmi « Les liens possibles », ceux qui comptent vraiment pour ce document (une norme ou un autre document cité, l’entreprise qui l’émet, une personne, le projet…) — le chemin exact, et une phrase pourquoi ; aucun autre.',
          '5. Ta **confiance**, de 0 à 1, et ta **raison** en une phrase.',
          'N’invente rien : ce qui n’est pas dans les listes reste vide.'
      ].join('\n'),
      // Avec les entités nouvelles (0.138.0), sans la relation entre documents.
      [
          'Tu analyses un document qui entre dans la bibliothèque. Lis sa fiche et le début de son texte, puis :',
          '1. Son **type de pièce** : un code de la liste des types de pièce (CCTP, CCAP…), sinon vide.',
          '2. Son **émetteur** : une entreprise de la liste (son code), sinon vide.',
          '3. Le **projet** qu’il concerne : le chemin exact d’un projet de la liste (son nom, son client, sa référence apparaissent dans le document), sinon vide.',
          '4. Ses **liens** : parmi « Les liens possibles », ceux qui comptent vraiment pour ce document (une norme ou un autre document cité, l’entreprise qui l’émet, une personne, le projet…) — le chemin exact, et une phrase pourquoi ; aucun autre.',
          '5. Les **entreprises et personnes nouvelles** : celles que le document cite clairement (son émetteur, son client, un signataire, un contact) mais qui ne sont ni dans les listes ni dans les liens possibles — à proposer, pas à lier : leur sorte, leur nom, le code d’une entreprise s’il est écrit, l’entreprise d’une personne si elle est dite, et pourquoi. Dans le doute, n’en propose pas.',
          '6. Ta **confiance**, de 0 à 1, et ta **raison** en une phrase.',
          'N’invente rien : ce qui n’est pas dans les listes reste vide.'
      ].join('\n')
    ]
  },
  en: {
    'Analyse a document': [
      [
        'You analyse a document entering the library. Read its record and the beginning of its text, then:',
        '1. Its **document type**: a code from the list of document types, otherwise empty.',
        '2. Its **issuer**: a company from the list (its code), otherwise empty.',
        '3. The **project** it concerns: the exact path of a project from the list (its name, client or reference appear in the document), otherwise empty.',
        '4. Your **confidence**, from 0 to 1, and your **reason** in one sentence.',
        'Invent nothing: what is not in the lists stays empty.'
      ].join('\n'),
      [
        'You analyse a document entering the library. Read its record and the beginning of its text, then:',
        '1. Its **document type**: a code from the list of document types, otherwise empty.',
        '2. Its **issuer**: a company from the list (its code), otherwise empty.',
        '3. The **project** it concerns: the exact path of a project from the list (its name, client or reference appear in the document), otherwise empty.',
          '4. Its **links**: among “The possible links”, those that really matter for this document (a standard or another document cited, the issuing company, a person, the project…) — the exact path, and one sentence why; no other.',
          '5. Your **confidence**, from 0 to 1, and your **reason** in one sentence.',
          'Invent nothing: what is not in the lists stays empty.'
      ].join('\n'),
      [
          'You analyse a document entering the library. Read its record and the beginning of its text, then:',
          '1. Its **document type**: a code from the list of document types, otherwise empty.',
          '2. Its **issuer**: a company from the list (its code), otherwise empty.',
          '3. The **project** it concerns: the exact path of a project from the list (its name, client or reference appear in the document), otherwise empty.',
          '4. Its **links**: among “The possible links”, those that really matter for this document (a standard or another document cited, the issuing company, a person, the project…) — the exact path, and one sentence why; no other.',
          '5. The **new companies and people**: those the document clearly cites (its issuer, its client, a signatory, a contact) but that are neither in the lists nor among the possible links — to propose, not to link: their kind, their name, a company’s code if written, a person’s company if stated, and why. When in doubt, propose none.',
          '6. Your **confidence**, from 0 to 1, and your **reason** in one sentence.',
          'Invent nothing: what is not in the lists stays empty.'
      ].join('\n')
    ]
  }
}

/** Les textes d'avant d'un skill livré (pour le mettre à jour s'il est resté tel quel). */
export function previousStarterTexts(name: string, language: string): readonly string[] {
  return PREVIOUS[language === 'en' ? 'en' : 'fr'][name] ?? []
}

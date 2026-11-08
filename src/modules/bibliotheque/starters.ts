// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Les exemples des bibliothèques de prompts et de personas, pour l'analyse d'un appel
 * d'offres : écrits dans le coffre seulement à la demande (« Ajouter les exemples »), dans
 * la langue de l'utilisateur. Ce sont des notes comme les autres : à modifier, à retirer.
 */

import type { EntryDraft, EntryKind } from './entries'

type Language = 'fr' | 'en'

const entry = (name: string, category: string, description: string, text: string): EntryDraft => ({ name, category, description, text, favorite: false })

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

/** Les exemples d'une bibliothèque, dans la langue de l'utilisateur. */
export function startersFor(kind: EntryKind, language: string): EntryDraft[] {
  const lang: Language = language === 'en' ? 'en' : 'fr'
  return (kind === 'prompt' ? PROMPTS : PERSONAS)[lang]
}

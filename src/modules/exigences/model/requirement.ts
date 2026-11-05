// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Une exigence : un énoncé normatif, dans autant de langues qu'il est écrit.
 *
 * Son identité, c'est son identifiant — ni le nom du fichier, ni le texte. Une exigence
 * reformulée reste la même exigence : c'est tout le principe de la traçabilité. Aussi
 * l'identifiant est attribué une fois, jamais réutilisé, et rien d'autre ne le porte.
 */

/** La formulation dans une langue. */
export interface ReqText {
  body: string
  /**
   * La révision de la formulation source dont celle-ci a été tirée. C'est tout le
   * mécanisme de retard : une traduction faite sur la révision 5 d'une exigence passée en
   * révision 7 n'a pas été mise à jour, sans que personne ait à le signaler.
   */
  fromRev: number
  at: string
  by: string
  /** Écrite par une personne ou par une machine — noté à la source, jamais deviné. */
  origin: 'human' | 'machine'
  /** Une formulation de machine qu'une personne a lue et acceptée. Sans objet pour une personne. */
  reviewed: boolean
}

export interface ReqRevision {
  rev: number
  at: string
  by: string
  /** La formulation qui a changé. */
  lang: string
  /** Ce qu'elle disait avant, pour qu'un changement se lise et pas seulement se compte. */
  was: string
  note: string
}

export interface ReqLink {
  kind: ReqLinkKind
  /** L'identifiant de l'autre exigence, ou d'un ticket pour les liens qui sortent de la bibliothèque. */
  to: string
  /**
   * Posé quand l'autre bout a changé après la création du lien : il ne tient peut-être
   * plus, et personne n'a vérifié. Seule une personne le retire.
   */
  suspect?: boolean
}

/** Les relations qu'une exigence peut porter, dans le vocabulaire du métier. */
export const REQ_LINK_KINDS = ['derives-from', 'refines', 'conflicts-with', 'duplicates', 'satisfied-by'] as const
export type ReqLinkKind = (typeof REQ_LINK_KINDS)[number]

/** Comment on montre qu'une exigence est satisfaite : les quatre de l'ingénierie système. */
export const VERIFICATION_METHODS = ['test', 'analysis', 'inspection', 'demonstration', 'none'] as const
export type VerificationMethod = (typeof VERIFICATION_METHODS)[number]

export interface Requirement {
  id: string
  title: string
  /** La catégorie sous laquelle l'identifiant a été attribué. La changer ne change jamais l'identifiant. */
  category: string
  type: string
  status: string
  criticality: string
  verification: VerificationMethod
  /** D'où elle vient : une norme, un document client, une réunion. Texte libre, exprès. */
  source: string
  rationale: string
  owner: string
  tags: string[]
  /**
   * Les autres noms sous lesquels cette même exigence est citée : la numérotation d'un
   * projet ou d'un client. Pas une seconde identité : l'identifiant reste ce qu'il est.
   */
  aliases: string[]
  /** La langue dans laquelle l'exigence est rédigée ; toute autre formulation est une traduction. */
  sourceLang: string
  /** Augmentée à chaque changement de la formulation source ; les traductions s'y mesurent. */
  rev: number
  text: Record<string, ReqText>
  links: ReqLink[]
  history: ReqRevision[]
  createdAt: string
  updatedAt: string
  filePath?: string
}

/** Un identifiant provisoire, quand aucun n'est donné (il est remplacé à la création). */
function provisionalId(): string {
  return `req-${Math.random().toString(36).slice(2, 10)}`
}

export function makeReqText(over: Partial<ReqText> = {}): ReqText {
  return {
    body: '',
    fromRev: 1,
    at: new Date().toISOString(),
    by: '',
    origin: 'human',
    reviewed: true,
    ...over
  }
}

export function makeRequirement(over: Partial<Requirement> = {}): Requirement {
  const now = new Date().toISOString()
  return {
    id: over.id ?? provisionalId(),
    title: '',
    category: '',
    type: '',
    status: '',
    criticality: '',
    verification: 'none',
    source: '',
    rationale: '',
    owner: '',
    tags: [],
    aliases: [],
    sourceLang: 'fr',
    rev: 1,
    text: {},
    links: [],
    history: [],
    createdAt: now,
    updatedAt: now,
    ...over
  }
}

/** La formulation dans une langue, ou `null` si elle n'est pas écrite. */
export function textOf(requirement: Requirement, lang: string): ReqText | null {
  return requirement.text[lang] ?? null
}

/** La formulation à montrer : celle demandée, sinon celle de la langue source. */
export function displayText(requirement: Requirement, lang: string): ReqText | null {
  return textOf(requirement, lang) ?? textOf(requirement, requirement.sourceLang)
}

/** Une formulation en retard sur la source ? La source ne l'est jamais sur elle-même. */
export function isStale(requirement: Requirement, lang: string): boolean {
  if (lang === requirement.sourceLang) return false
  const held = textOf(requirement, lang)
  return held === null ? false : held.fromRev < requirement.rev
}

/** Les traductions qui ne suivent plus la source, dans l'ordre donné. */
export function staleLanguages(requirement: Requirement, langs: string[]): string[] {
  return langs.filter((lang) => isStale(requirement, lang))
}

/** Les langues voulues que cette exigence n'a pas du tout. */
export function missingLanguages(requirement: Requirement, langs: string[]): string[] {
  return langs.filter((lang) => textOf(requirement, lang) === null)
}

/**
 * Écrit la formulation dans une langue, et garde les autres honnêtes.
 *
 * Changer la source augmente la révision : toutes les traductions se lisent alors en
 * retard sans qu'on y touche. Changer une traduction n'est pas changer l'exigence — c'est
 * la traduction qui rattrape —, la révision ne bouge pas. Réécrire les mêmes mots ne
 * change rien du tout : un éditeur qui enregistre à chaque frappe ne doit pas fabriquer
 * un historique.
 */
export function setText(
  requirement: Requirement,
  lang: string,
  body: string,
  by: string,
  origin: ReqText['origin'] = 'human'
): Requirement {
  const previous = textOf(requirement, lang)
  if (previous && previous.body === body && previous.origin === origin) return requirement

  const now = new Date().toISOString()
  const isSource = lang === requirement.sourceLang
  const rev = isSource && previous ? requirement.rev + 1 : requirement.rev
  const written = makeReqText({
    body,
    // Une traduction note la source dont elle est tirée ; la source se note elle-même.
    fromRev: isSource ? rev : requirement.rev,
    at: now,
    by,
    origin,
    // Une formulation de machine commence non relue ; une personne qui écrit compte comme l'ayant lue.
    reviewed: origin === 'human'
  })

  const history: ReqRevision[] =
    previous === null
      ? requirement.history
      : [...requirement.history, { rev, at: now, by, lang, was: previous.body, note: '' }]

  return {
    ...requirement,
    rev,
    text: { ...requirement.text, [lang]: written },
    history,
    updatedAt: now,
    // Une source qui bouge met en doute les liens qu'elle porte ; ceux des autres vers elle
    // sont marqués par la bibliothèque, qui les voit.
    links: isSource && previous ? requirement.links.map((link) => ({ ...link, suspect: true })) : requirement.links
  }
}

/** Une personne qui dit avoir lu une formulation de machine : la seule façon de la marquer relue. */
export function acceptText(requirement: Requirement, lang: string, by: string): Requirement {
  const held = textOf(requirement, lang)
  if (held === null || held.reviewed) return requirement
  return {
    ...requirement,
    text: { ...requirement.text, [lang]: { ...held, reviewed: true, by, at: new Date().toISOString() } },
    updatedAt: new Date().toISOString()
  }
}

/** Une formulation écrite par une machine que personne n'a encore lue. */
export function isUnreviewedMachine(requirement: Requirement, lang: string): boolean {
  const held = textOf(requirement, lang)
  return held !== null && held.origin === 'machine' && !held.reviewed
}

// ── Les liens ──────────────────────────────────────────────────────────────────────

function sameLink(link: ReqLink, kind: ReqLinkKind, to: string): boolean {
  return link.kind === kind && link.to.toUpperCase() === to.toUpperCase()
}

/** Ajoute une relation, une fois : la même affirmée deux fois reste une seule affirmation. */
export function addLink(requirement: Requirement, kind: ReqLinkKind, to: string): Requirement {
  const target = to.trim()
  if (!target || target.toUpperCase() === requirement.id.toUpperCase()) return requirement
  if (requirement.links.some((link) => sameLink(link, kind, target))) return requirement
  return {
    ...requirement,
    links: [...requirement.links, { kind, to: target }],
    updatedAt: new Date().toISOString()
  }
}

export function removeLink(requirement: Requirement, kind: ReqLinkKind, to: string): Requirement {
  const links = requirement.links.filter((link) => !sameLink(link, kind, to))
  if (links.length === requirement.links.length) return requirement
  return { ...requirement, links, updatedAt: new Date().toISOString() }
}

/** Une personne qui dit avoir regardé un lien dont l'autre bout a bougé. Seule une personne le peut. */
export function clearSuspect(requirement: Requirement, kind: ReqLinkKind, to: string): Requirement {
  if (!requirement.links.some((link) => sameLink(link, kind, to) && link.suspect)) return requirement
  return {
    ...requirement,
    links: requirement.links.map((link) => {
      if (!sameLink(link, kind, to)) return link
      return { kind: link.kind, to: link.to }
    }),
    updatedAt: new Date().toISOString()
  }
}

/**
 * Marque tous les liens qui pointent vers une exigence qui vient de bouger : ce que
 * celle-ci dit de l'autre a été écrit sur des mots qu'elle n'a plus. C'est ce sens-là
 * qu'une revue doit traiter.
 */
export function markLinksToward(requirement: Requirement, movedId: string): Requirement {
  if (!requirement.links.some((link) => link.to.toUpperCase() === movedId.toUpperCase() && !link.suspect)) {
    return requirement
  }
  return {
    ...requirement,
    links: requirement.links.map((link) => (link.to.toUpperCase() === movedId.toUpperCase() ? { ...link, suspect: true } : link)),
    updatedAt: new Date().toISOString()
  }
}

/** Les relations d'un type que cette exigence affirme. */
export function linksOfKind(requirement: Requirement, kind: ReqLinkKind): ReqLink[] {
  return requirement.links.filter((link) => link.kind === kind)
}

export function hasSuspectLinks(requirement: Requirement): boolean {
  return requirement.links.some((link) => link.suspect === true)
}

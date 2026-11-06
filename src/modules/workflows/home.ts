// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Ce que les workflows montrent sur l'accueil : combien sont actifs, et les dernières exécutions. */

import type { FileSystem } from '../../core/ports'
import type { HomeSectionView, ListItem, Tone, ViewsRegistrar } from '../../core/views'
import { journalPath } from './engine'
import type { Workflow } from './model'
import type { Translate } from './registry'

const TONES: Record<string, Tone> = { '✅': 'success', '❌': 'danger', '⏭️': 'neutral', '⛔': 'warning' }

/** Les dernières lignes du journal, comme éléments de liste. */
export function journalItems(journal: string, count: number): Omit<ListItem, 'open'>[] {
  const out: Omit<ListItem, 'open'>[] = []
  for (const line of journal.split('\n')) {
    const found = /^- (\d{4}-\d{2}-\d{2} \d{2}:\d{2}) · (✅|❌|⏭️|⛔) [^·]+ · \*\*(.+?)\*\*(.*)$/u.exec(line)
    if (!found) continue
    const detail = found[4]!.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, path: string, label?: string) => label ?? path.slice(path.lastIndexOf('/') + 1))
    out.push({ id: `${out.length}`, title: found[3]!, when: found[1]!, tone: TONES[found[2]!] ?? 'neutral', detail: detail.replace(/^ · /, '').trim() })
    if (out.length >= count) break
  }
  return out
}

export function registerWorkflowsHome(
  views: ViewsRegistrar | undefined,
  deps: { t: Translate; fs: FileSystem; folder(): string; load(): Workflow[]; run(id: string): Promise<void>; openJournal(): Promise<void> }
): void {
  if (!views) return
  const { t } = deps
  views.home({
    id: 'workflows.recent',
    order: 40,
    area: 'side',
    async load(): Promise<HomeSectionView> {
      const workflows = deps.load()
      const path = journalPath(deps.folder(), t)
      const journal = (await deps.fs.exists(path)) ? await deps.fs.readText(path) : ''
      const items = journalItems(journal, 5).map((item) => ({ ...item, open: { id: 'journal', label: t('workflows.home.journal'), run: deps.openJournal } }))
      return {
        title: t('workflows.home.title'),
        subtitle: t('workflows.home.subtitle', { active: workflows.filter((each) => each.enabled).length, count: workflows.length }),
        icon: 'flow',
        blocks: [
          { kind: 'list', items, empty: t('workflows.journal.none') },
          {
            kind: 'actions',
            actions: [
              { id: 'new', label: t('workflows.command.new'), icon: 'plus', run: () => deps.run('nouveau') },
              { id: 'list', label: t('workflows.home.all'), icon: 'flow', run: () => deps.run('liste') },
              { id: 'journal', label: t('workflows.home.journal'), icon: 'book', run: deps.openJournal }
            ]
          }
        ]
      }
    }
  })
  views.nav({ id: 'workflows', label: t('workflows.name'), icon: 'flow', order: 30, run: () => deps.run('liste') })
  const group = t('workflows.name')
  views.tile({
    id: 'workflows.liste',
    label: t('workflows.name'),
    icon: 'flow',
    color: 'rose',
    group,
    order: 30,
    byDefault: true,
    description: t('workflows.tile.list.desc'),
    run: () => deps.run('liste'),
    async badge() {
      // Un échec parmi les dernières exécutions : à voir.
      const path = journalPath(deps.folder(), t)
      const journal = (await deps.fs.exists(path)) ? await deps.fs.readText(path) : ''
      const failed = journalItems(journal, 10).filter((item) => item.tone === 'danger').length
      return failed ? { text: String(failed), tone: 'danger', label: t('workflows.tile.failed', { count: failed }) } : null
    }
  })
  views.tile({ id: 'workflows.nouveau', label: t('workflows.command.new'), icon: 'plus', color: 'rose', group, order: 31, description: t('workflows.tile.new.desc'), run: () => deps.run('nouveau') })
  views.tile({ id: 'workflows.journal', label: t('workflows.home.journal'), icon: 'book', color: 'rose', group, order: 32, description: t('workflows.tile.journal.desc'), run: deps.openJournal })
}

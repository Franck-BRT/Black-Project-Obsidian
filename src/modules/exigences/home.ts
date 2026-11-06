// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Ce que la bibliothèque d'exigences montre sur l'accueil : combien, quelle note, combien de faibles. */

import type { HomeSectionView, ViewsRegistrar } from '../../core/views'
import type { Session } from './flows'
import { assessAll } from './quality/report'

export function registerExigencesHome(views: ViewsRegistrar | undefined, session: Session, run: (id: string) => Promise<void>): void {
  if (!views) return
  const { t } = session
  views.home({
    id: 'exigences.library',
    order: 30,
    area: 'side',
    async load(): Promise<HomeSectionView> {
      const settings = session.settings()
      const library = await session.store.all()
      const runs = assessAll(library, settings.languages, 'record')
      const mean = runs.length ? runs.reduce((sum, each) => sum + each.report.score, 0) / runs.length : null
      const weak = runs.filter((each) => each.report.stars < 3).length
      const lagging = library.filter((requirement) =>
        settings.languages.some((lang) => {
          const text = requirement.text[lang]
          return lang !== requirement.sourceLang && (!text || text.fromRev < requirement.rev || !text.reviewed)
        })
      ).length
      return {
        title: t('exigences.home.title'),
        subtitle: t('exigences.home.subtitle', { folder: settings.folder }),
        icon: 'list',
        blocks: [
          {
            kind: 'stats',
            stats: [
              { label: t('exigences.home.count'), value: String(library.length), icon: 'list' },
              {
                label: t('exigences.home.mean'),
                value: mean === null ? '—' : `${Math.round(mean * 100)} %`,
                icon: 'star',
                ...(mean === null ? {} : { hint: '★'.repeat(Math.round(mean * 5)) + '☆'.repeat(5 - Math.round(mean * 5)) })
              },
              {
                label: t('exigences.home.weak'),
                value: String(weak),
                tone: weak ? 'warning' : 'success',
                hint: t(weak ? 'exigences.home.weak.some' : 'exigences.home.weak.none')
              },
              {
                label: t('exigences.home.lagging'),
                value: String(lagging),
                tone: lagging ? 'info' : 'success',
                hint: t(lagging ? 'exigences.home.lagging.some' : 'exigences.home.lagging.none')
              }
            ]
          },
          {
            kind: 'actions',
            actions: [
              { id: 'new', label: t('exigences.command.create'), icon: 'plus', run: () => run('nouvelle') },
              { id: 'list', label: t('exigences.home.browse'), icon: 'search', run: () => run('liste') },
              { id: 'quality', label: t('exigences.home.quality'), icon: 'star', run: () => run('qualite') }
            ]
          }
        ]
      }
    }
  })
  views.nav({ id: 'exigences', label: t('exigences.home.nav'), icon: 'list', order: 20, run: () => run('liste') })
}

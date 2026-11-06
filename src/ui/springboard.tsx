// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * L'accueil à tuiles, à la manière d'un écran de téléphone : chaque tuile est un raccourci
 * vers un module ; l'utilisateur choisit les siennes et les range. « Modifier l'accueil »
 * fait trembler les tuiles (pas si le mouvement est réduit) : − pour retirer, glisser pour
 * déplacer (ou Alt + flèches au clavier), et la liste des tuiles à ajouter, par module.
 * L'agencement est gardé dans les réglages.
 */

import { useEffect, useState } from 'preact/hooks'
import type { TileBadge, TileSpec } from '../core/views'
import type { AppHost } from './host'
import { Icon } from './icons'
import { addableTiles, moveTile, shownTiles } from './tiles'

function Badge({ tile, generation }: { tile: TileSpec; generation: number }) {
  const [badge, setBadge] = useState<TileBadge | null>(null)
  useEffect(() => {
    let alive = true
    tile
      .badge?.()
      .then((value) => alive && setBadge(value))
      .catch(() => alive && setBadge(null))
    return () => {
      alive = false
    }
  }, [tile, generation])
  if (!badge) return null
  return (
    <>
      <span class={`bp-tile-badge bp-tone-${badge.tone}`} title={badge.label} aria-hidden="true">
        {badge.text}
      </span>
      {/* Pour les lecteurs d'écran : ce que dit la pastille, dans le nom de la tuile. */}
      <span class="bp-sr">{` — ${badge.label}`}</span>
    </>
  )
}

function TileIcon({ tile }: { tile: TileSpec }) {
  return (
    <span class={`bp-tile-icon bp-tile-${tile.color}`} aria-hidden="true">
      <Icon name={tile.icon} />
    </span>
  )
}

export function Springboard({ host, generation, tiles }: { host: AppHost; generation: number; tiles: TileSpec[] }) {
  const { t } = host
  const [editing, setEditing] = useState(false)
  const [ids, setIds] = useState<string[]>(() => shownTiles(tiles, host.homeTiles()).map((tile) => tile.id))
  const [dragged, setDragged] = useState<number | null>(null)
  const [said, setSaid] = useState('')
  useEffect(() => setIds(shownTiles(tiles, host.homeTiles()).map((tile) => tile.id)), [generation])

  const byId = new Map(tiles.map((tile) => [tile.id, tile]))
  const shown = ids.map((id) => byId.get(id)).filter((tile): tile is TileSpec => !!tile)
  const save = (next: string[], message: string) => {
    setIds(next)
    setSaid(message)
    void host.saveHomeTiles(next)
  }
  const move = (from: number, to: number) => {
    if (to < 0 || to >= shown.length || from === to) return
    save(
      moveTile(
        shown.map((tile) => tile.id),
        from,
        to
      ),
      t('ui.tiles.moved', { label: shown[from]!.label, position: to + 1, count: shown.length })
    )
  }
  const remove = (index: number) => save(shown.filter((_, at) => at !== index).map((tile) => tile.id), t('ui.tiles.removed', { label: shown[index]!.label }))
  const add = (tile: TileSpec) => save([...shown.map((each) => each.id), tile.id], t('ui.tiles.added', { label: tile.label }))
  const reset = () => {
    const defaults = shownTiles(tiles, null).map((tile) => tile.id)
    setIds(defaults)
    setSaid(t('ui.tiles.reset'))
    void host.saveHomeTiles(null)
  }

  return (
    <section class={`bp-springboard${editing ? ' is-editing' : ''}`} aria-labelledby="bp-tiles-title">
      <div class="bp-springboard-bar">
        <h2 class="bp-sr" id="bp-tiles-title">
          {t('ui.tiles')}
        </h2>
        {editing && <p class="bp-intro">{t('ui.tiles.help')}</p>}
        <div class="bp-header-tools">
          {editing && (
            <button type="button" class="bp-button" onClick={reset}>
              <Icon name="refresh" />
              <span>{t('ui.tiles.reset')}</span>
            </button>
          )}
          <button type="button" class={`bp-button${editing ? ' bp-button-primary' : ''}`} aria-pressed={editing} onClick={() => setEditing(!editing)}>
            <Icon name={editing ? 'check' : 'grid'} />
            <span>{t(editing ? 'ui.tiles.done' : 'ui.tiles.edit')}</span>
          </button>
        </div>
      </div>
      <p class="bp-sr" aria-live="polite">
        {said}
      </p>
      {shown.length === 0 && !editing && <p class="bp-empty">{t('ui.tiles.empty')}</p>}
      <ul class="bp-tiles" role="list">
        {shown.map((tile, index) => (
          <li
            key={tile.id}
            class={`bp-tile-cell${dragged === index ? ' is-dragged' : ''}`}
            draggable={editing}
            onDragStart={(event) => {
              setDragged(index)
              event.dataTransfer?.setData('text/plain', tile.id)
            }}
            onDragOver={(event) => {
              if (editing && dragged !== null) event.preventDefault()
            }}
            onDrop={(event) => {
              event.preventDefault()
              if (dragged !== null) move(dragged, index)
              setDragged(null)
            }}
            onDragEnd={() => setDragged(null)}
          >
            <button
              type="button"
              class="bp-tile"
              data-tile={tile.id}
              title={tile.description}
              aria-describedby={editing ? undefined : undefined}
              onClick={() => {
                if (!editing) void tile.run()
              }}
              onKeyDown={(event) => {
                if (!editing || !event.altKey) return
                if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                  event.preventDefault()
                  move(index, index - 1)
                } else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                  event.preventDefault()
                  move(index, index + 1)
                }
              }}
            >
              <TileIcon tile={tile} />
              <span class="bp-tile-label">{tile.label}</span>
              {!editing && <Badge tile={tile} generation={generation} />}
            </button>
            {editing && (
              <button type="button" class="bp-tile-remove" aria-label={t('ui.tiles.remove', { label: tile.label })} title={t('ui.tiles.remove', { label: tile.label })} onClick={() => remove(index)}>
                −
              </button>
            )}
          </li>
        ))}
      </ul>
      {editing && (
        <section class="bp-section bp-tile-gallery" aria-labelledby="bp-tiles-add">
          <h2 class="bp-section-title" id="bp-tiles-add">
            <Icon name="plus" />
            {t('ui.tiles.addTitle')}
          </h2>
          <p class="bp-section-sub">{t('ui.tiles.addIntro')}</p>
          {addableTiles(tiles, shown).length === 0 && <p class="bp-empty">{t('ui.tiles.none')}</p>}
          {addableTiles(tiles, shown).map(({ group, tiles: list }) => (
            <div key={group} class="bp-tile-group">
              <h3>{group}</h3>
              <ul class="bp-tiles" role="list">
                {list.map((tile) => (
                  <li key={tile.id} class="bp-tile-cell">
                    <button type="button" class="bp-tile" aria-label={t('ui.tiles.add', { label: tile.label })} title={tile.description} onClick={() => add(tile)}>
                      <TileIcon tile={tile} />
                      <span class="bp-tile-label">{tile.label}</span>
                      <span class="bp-tile-badge bp-tile-plus" aria-hidden="true">
                        +
                      </span>
                    </button>
                    {tile.description && <p class="bp-tile-desc">{tile.description}</p>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}
    </section>
  )
}

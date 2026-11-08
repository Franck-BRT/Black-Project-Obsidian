// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * Le **glisser-déposer** de fichiers : une page (verser dans la bibliothèque là où l'on
 * est) ou une carte (un répertoire) qui en accepte les reçoit de l'ordinateur. Pendant le
 * survol, elle se signale ; au dépôt, les fichiers sont lus (leur nom, leurs octets) et
 * remis à `drop.run`, puis la page se redessine. Un dossier glissé (illisible comme
 * fichier) est laissé de côté. Il y a toujours un bouton qui fait la même chose (au
 * clavier) : le glisser-déposer n'est qu'un raccourci.
 */

import { createContext } from 'preact'
import { useContext, useEffect, useRef, useState } from 'preact/hooks'
import type { ExternalFile } from '../core/ports'
import type { FileDrop } from '../core/views'
import { AfterAction } from './components'

/**
 * Ce que dit le bandeau de la page pendant le survol : la cible la plus proche du pointeur
 * (une carte de répertoire, dans la page) le remplace par le sien, le temps du survol.
 */
export const DropLabel = createContext<((label: string | null) => void) | null>(null)

/** Des fichiers sont-ils glissés (et pas du texte, un lien) ? */
export function draggingFiles(event: DragEvent): boolean {
  return [...(event.dataTransfer?.types ?? [])].includes('Files')
}

/** Lire les fichiers déposés ; ceux qu'on ne peut pas lire (un dossier) sont laissés de côté. */
export async function readDropped(files: readonly File[]): Promise<ExternalFile[]> {
  const read = await Promise.all(
    files.map(async (file): Promise<ExternalFile | null> => {
      try {
        return {
          name: file.name,
          bytes: new Uint8Array(await file.arrayBuffer())
        }
      } catch {
        return null
      }
    })
  )
  return read.filter((each): each is ExternalFile => each !== null)
}

export interface DropState {
  /** Des fichiers la survolent. */
  over: boolean
  /** Les fichiers déposés sont en train d'être versés. */
  busy: boolean
  /** À poser sur l'élément qui reçoit (rien sans `drop`). */
  props: Record<string, unknown>
}

/** Faire d'un élément une cible de dépôt de fichiers. */
export function useFileDrop(drop: FileDrop | undefined): DropState {
  const after = useContext(AfterAction)
  const [over, setOver] = useState(false)
  const [busy, setBusy] = useState(false)
  // Les entrées et sorties des enfants remontent : on compte pour savoir quand on sort vraiment.
  const depth = useRef(0)
  const tell = useContext(DropLabel)
  const label = drop?.label
  useEffect(() => {
    if (!tell || !label) return
    tell(over ? label : null)
  }, [over, label, tell])
  if (!drop) return { over: false, busy: false, props: {} }
  return {
    over,
    busy,
    props: {
      onDragEnter: (event: DragEvent) => {
        if (!draggingFiles(event)) return
        event.preventDefault()
        depth.current++
        setOver(true)
      },
      onDragOver: (event: DragEvent) => {
        if (!draggingFiles(event)) return
        // Sans cela, le navigateur (ou Obsidian) prendrait le dépôt pour lui.
        event.preventDefault()
        event.stopPropagation()
        if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
      },
      onDragLeave: () => {
        depth.current = Math.max(0, depth.current - 1)
        if (depth.current === 0) setOver(false)
      },
      onDrop: async (event: DragEvent) => {
        if (!draggingFiles(event)) return
        event.preventDefault()
        event.stopPropagation()
        depth.current = 0
        setOver(false)
        const files = await readDropped([...(event.dataTransfer?.files ?? [])])
        if (!files.length) return
        setBusy(true)
        try {
          await drop.run(files)
        } finally {
          setBusy(false)
          after()
        }
      }
    }
  }
}

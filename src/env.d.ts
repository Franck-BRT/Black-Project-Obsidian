// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/** Les pages de documentation, embarquées comme du texte (esbuild et Vitest). */
declare module '*.md' {
  const content: string
  export default content
}

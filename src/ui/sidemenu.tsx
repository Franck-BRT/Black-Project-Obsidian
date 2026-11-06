// Copyright © 2026 Black Room Technologies. Tous droits réservés.
// Logiciel propriétaire — voir le fichier LICENSE.

/**
 * La barre de gauche : Accueil toujours en haut, Paramètres toujours en bas, et entre les
 * deux le menu que l'utilisateur range. « Modifier le menu » : glisser une entrée pour la
 * déplacer, ou ses boutons Monter, Descendre, Retirer ; la liste « Ajouter au menu »
 * propose les entrées retirées et toutes les fonctions des modules. Le rangement est gardé
 * dans les réglages.
 */

import { useEffect, useRef, useState } from "preact/hooks";
import type { NavEntry, TileSpec } from "../core/views";
import type { AppHost } from "./host";
import { Icon } from "./icons";
import {
  addableMenu,
  menuCatalog,
  menuLayout,
  shownMenu,
  type MenuItem,
} from "./menu";
import { moveTile } from "./tiles";

/** L'entrée du tableau de bord : celle de l'interface même. */
export const DASHBOARD_ENTRY = "ui.dashboard";

export function SideMenu({
  host,
  generation,
  tiles,
  page,
  goHome,
  goDashboard,
  editing,
  setEditing,
}: {
  host: AppHost;
  generation: number;
  tiles: TileSpec[];
  page: "home" | "dashboard";
  goHome: () => void;
  goDashboard: () => void;
  editing: boolean;
  setEditing: (editing: boolean) => void;
}) {
  const { t } = host;
  const home = t("ui.nav.home");
  const settings = t("home.nav.settings");
  const entries: NavEntry[] = [
    {
      id: DASHBOARD_ENTRY,
      label: t("ui.nav.dashboard"),
      icon: "chart",
      order: 0,
      run: goDashboard,
    },
    ...host.nav(),
  ];
  const items = menuCatalog(
    entries,
    tiles,
    t("ui.menu.group"),
    host.openSettings ? [home, settings] : [home],
  );
  const [ids, setIds] = useState<string[]>(() =>
    shownMenu(items, host.navMenu()),
  );
  const [dragged, setDragged] = useState<number | null>(null);
  const [said, setSaid] = useState("");
  const [focus, setFocus] = useState<{ id: string; tool: string } | null>(null);
  const root = useRef<HTMLElement>(null);
  useEffect(() => setIds(shownMenu(items, host.navMenu())), [generation]);
  // Après un déplacement au clavier, le focus suit l'entrée (ou son premier bouton actif).
  useEffect(() => {
    if (!focus || !root.current) return;
    const row = root.current.querySelector<HTMLElement>(
      `[data-entry="${focus.id}"]`,
    );
    const wanted = row?.querySelector<HTMLButtonElement>(
      `[data-tool="${focus.tool}"]`,
    );
    const target =
      wanted && !wanted.disabled
        ? wanted
        : (row?.querySelector<HTMLButtonElement>("button:not([disabled])") ??
          root.current.querySelector<HTMLButtonElement>('[data-tool="edit"]'));
    target?.focus();
    setFocus(null);
  }, [focus]);

  const byId = new Map(items.map((item) => [item.id, item]));
  const shown = ids
    .map((id) => byId.get(id))
    .filter((item): item is MenuItem => !!item);
  const save = (
    next: string[],
    message: string,
    then?: { id: string; tool: string },
  ) => {
    setIds(next);
    setSaid(message);
    if (then) setFocus(then);
    void host.saveNavMenu(menuLayout(items, next, host.navMenu()));
  };
  const move = (from: number, to: number, tool?: string) => {
    if (to < 0 || to >= shown.length || from === to) return;
    const item = shown[from]!;
    save(
      moveTile(
        shown.map((each) => each.id),
        from,
        to,
      ),
      t("ui.menu.moved", {
        label: item.label,
        position: to + 2,
        count: shown.length + 2,
      }),
      tool ? { id: item.id, tool } : undefined,
    );
  };
  const remove = (index: number) => {
    const item = shown[index]!;
    const next = shown.filter((_, at) => at !== index);
    // Le focus passe à l'entrée suivante (ou précédente), sinon au bouton « Terminé ».
    const neighbour = next[index] ?? next[index - 1];
    save(
      next.map((each) => each.id),
      t("ui.menu.removed", { label: item.label }),
      neighbour
        ? { id: neighbour.id, tool: "remove" }
        : { id: "", tool: "edit" },
    );
  };
  const add = (item: MenuItem) =>
    save([...ids, item.id], t("ui.menu.added", { label: item.label }), {
      id: item.id,
      tool: "remove",
    });
  const reset = () => {
    setIds(shownMenu(items, null));
    setSaid(t("ui.menu.reset"));
    void host.saveNavMenu(null);
  };
  const addable = addableMenu(items, ids);

  const tool = (
    name: string,
    icon: Parameters<typeof Icon>[0]["name"],
    label: string,
    run: () => void,
    disabled = false,
  ) => (
    <button
      type="button"
      class="bp-menu-tool"
      data-tool={name}
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={run}
    >
      <Icon name={icon} />
    </button>
  );
  const pinnedNote = (label: string, note: string) => (
    <div class="bp-nav-item bp-menu-pinned" title={note}>
      <Icon name="lock" />
      <span>{label}</span>
      <span class="bp-sr">{` — ${note}`}</span>
    </div>
  );

  return (
    <nav
      class={`bp-nav${editing ? " is-editing" : ""}`}
      aria-label={t("ui.nav")}
      ref={root}
    >
      {/* Trois zones fixes : Preact ne mêle pas leurs éléments quand on passe en modification. */}
      <div class="bp-nav-top">
        {editing ? (
          pinnedNote(home, t("ui.menu.pinnedTop"))
        ) : (
          <button
            type="button"
            class="bp-nav-item"
            aria-current={page === "home" ? "page" : undefined}
            onClick={goHome}
          >
            <Icon name="home" />
            {home}
          </button>
        )}
      </div>
      <div class="bp-nav-middle">
        {editing ? (
          <>
            <p class="bp-menu-help">{t("ui.menu.help")}</p>
            <ul class="bp-menu-list" role="list">
              {shown.map((item, index) => (
                <li
                  key={item.id}
                  class={`bp-menu-row${dragged === index ? " is-dragged" : ""}`}
                  data-entry={item.id}
                  draggable
                  onDragStart={(event) => {
                    setDragged(index);
                    event.dataTransfer?.setData("text/plain", item.id);
                  }}
                  onDragOver={(event) => {
                    if (dragged !== null) event.preventDefault();
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (dragged !== null) move(dragged, index);
                    setDragged(null);
                  }}
                  onDragEnd={() => setDragged(null)}
                >
                  <span class="bp-dash-grip" aria-hidden="true">
                    <Icon name="grip" />
                  </span>
                  <Icon name={item.icon} />
                  <span class="bp-menu-label">{item.label}</span>
                  {tool(
                    "up",
                    "up",
                    t("ui.menu.up", { label: item.label }),
                    () => move(index, index - 1, "up"),
                    index === 0,
                  )}
                  {tool(
                    "down",
                    "down",
                    t("ui.menu.down", { label: item.label }),
                    () => move(index, index + 1, "down"),
                    index === shown.length - 1,
                  )}
                  {tool(
                    "remove",
                    "hide",
                    t("ui.menu.remove", { label: item.label }),
                    () => remove(index),
                  )}
                </li>
              ))}
            </ul>
            {shown.length === 0 && (
              <p class="bp-menu-help">{t("ui.menu.empty")}</p>
            )}
            <section class="bp-menu-add" aria-labelledby="bp-menu-add">
              <h2 class="bp-menu-add-title" id="bp-menu-add">
                <Icon name="plus" />
                {t("ui.menu.addTitle")}
              </h2>
              {addable.length === 0 && (
                <p class="bp-menu-help">{t("ui.menu.none")}</p>
              )}
              {addable.map(({ group, items: list }) => (
                <div key={group}>
                  <h3>{group}</h3>
                  <ul class="bp-menu-list" role="list">
                    {list.map((item) => (
                      <li
                        key={item.id}
                        class="bp-menu-row is-addable"
                        data-entry={item.id}
                      >
                        <Icon name={item.icon} />
                        <span class="bp-menu-label">{item.label}</span>
                        {tool(
                          "add",
                          "plus",
                          t("ui.menu.add", { label: item.label }),
                          () => add(item),
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </section>
            <button type="button" class="bp-menu-link" onClick={reset}>
              <Icon name="refresh" />
              <span>{t("ui.menu.reset")}</span>
            </button>
          </>
        ) : (
          shown.map((item) => (
            <button
              type="button"
              class="bp-nav-item"
              key={item.id}
              aria-current={
                item.id === DASHBOARD_ENTRY && page === "dashboard"
                  ? "page"
                  : undefined
              }
              onClick={() => void item.run()}
            >
              <Icon name={item.icon} />
              {item.label}
            </button>
          ))
        )}
      </div>
      <button
        type="button"
        class={`bp-menu-link${editing ? " is-done" : ""}`}
        data-tool="edit"
        aria-pressed={editing}
        onClick={() => setEditing(!editing)}
      >
        <Icon name={editing ? "check" : "edit"} />
        <span>{t(editing ? "ui.tiles.done" : "ui.menu.edit")}</span>
      </button>
      <p class="bp-sr" aria-live="polite">
        {said}
      </p>
      {host.openSettings && (
        <div class="bp-nav-bottom">
          {editing ? (
            pinnedNote(settings, t("ui.menu.pinnedBottom"))
          ) : (
            <button
              type="button"
              class="bp-nav-item"
              onClick={() => host.openSettings?.()}
            >
              <Icon name="settings" />
              {settings}
            </button>
          )}
        </div>
      )}
    </nav>
  );
}

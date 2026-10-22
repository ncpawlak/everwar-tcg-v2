---
name: vite-windows-watcher-restart
description: >
  Use when code edits don't appear in a running Vite dev server on Windows —
  the browser runs stale code even after saving and reloading, HMR silently
  no-ops, and a feature that "should" work does nothing (e.g. a new store
  action is undefined, a renamed function is missing). Covers verifying the
  served module and the restart-and-reload fix.
load_when: >
  Editing a live Vite/HMR app and the change isn't reflected in the browser;
  buttons/actions dead after an edit; suspected stale module. Match keywords:
  vite, HMR, hot reload, stale, watcher, Windows, dev server, not updating,
  module not fresh.
upstream: true
---
# Skill: Vite dev server on Windows serves stale modules → verify + restart

## Trigger
You edit a source file, but the running Vite dev server (Windows) keeps serving
the OLD transformed module. HMR never fires or fires without the change, so the
browser runs stale code. Symptoms: a newly added store action is `undefined`, a
renamed function is missing, a new component isn't mounted, or a feature that
passes tests + typecheck does nothing in the browser. Vite's file watcher
(chokidar) is unreliable on Windows, especially for edits made by tools/agents
and for delete-then-recreate operations.

## Diagnosis (fast, do this before touching the browser)
Fetch the **transformed module** straight from the dev server and grep for a
token that survives transform (a real identifier — NOT a JSX comment, which
Vite strips):

```powershell
$c = (Invoke-WebRequest "http://localhost:5173/src/state/gameStore.ts" -UseBasicParsing).Content
"newSymbol present: $($c -match 'destroyZoneA')"   # expect True after your edit
"old symbol gone:  $($c -match 'attackZoneA')"      # expect False after a rename
```

If the new symbol is missing (or the old one is still present after a rename),
the server is stale — the browser is running code that doesn't match disk. Stop
debugging the feature; it's a staleness problem, not a logic problem.

## The fix (permanent pattern)
Restart the dev server (clears Vite's transform cache / module graph), then
reload the browser canvas so it re-fetches fresh modules:

1. `stop_powershell(vite-dev)`
2. `powershell(npm run dev, mode async, detach true, shellId vite-dev)`
3. Re-verify the served module with the fetch+grep check above (confirm the new
   symbol is present and any renamed symbol is gone).
4. Reload the browser: `open_canvas(browser, everwar-preview, { url: "http://localhost:5173/" })`.

## Notes / gotchas
- **A passing test suite + clean typecheck does NOT prove the browser is fresh.**
  Those run against disk; the dev server serves its own cache. Always verify the
  *served* module for anything you can't see yourself (agent can't view the canvas).
- **Delete-then-recreate a file** (e.g. the `create` tool can't overwrite, so you
  `Remove-Item` then `create`) is especially likely to desync the watcher.
- Grep for an identifier or string literal, not a comment — Vite/esbuild strips
  comments during transform, so a comment token gives a false negative.
- Reserve the full restart for confirmed staleness; if the fetch check shows the
  new symbol is already served, HMR worked and a plain canvas reload is enough.

## Evidence
Everwar Phase 3 (2026-08-22): occurred **twice** in one phase. (1) InspectionPanel
+ rewritten PointerControls were live-edited but the browser ran the old
drag-on-press code — served `App.tsx` lacked `InspectionPanel`. (2) After renaming
`attackZoneA` → `destroyZoneA`/`destroyZoneB`, both Destroy buttons were dead: the
served `gameStore.ts` still had `attackZoneA` and neither new action, so the
buttons called `undefined`. Both were resolved by restart + reload; the served
`gameStore.ts` then showed `destroyZoneA/B: True`, `attackZoneA: False`. User
requested this be captured as a project skill after the second occurrence.

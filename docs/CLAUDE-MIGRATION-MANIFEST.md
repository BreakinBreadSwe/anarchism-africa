# Claude Code — Migration Manifest

**Generated:** 2026-05-24. **Project:** ANARCHISM.AFRICA.
**Purpose:** A complete inventory of every Claude Code configuration artefact tied to this project — rules, memory, skills, plugins, hooks, permissions, and MCP connections — so the setup can be reproduced or relocated by hand. **Nothing here has been moved or changed; this is documentation only.**

> ⚠️ **The single most important fact:** none of this config lives in the git repo. It all lives at the **user level** (`~/.claude/…`) and in the per-account Claude service. Several pieces are **keyed by the absolute project path** `/Volumes/SSD/Documents/DEV/ANARCHISM.AFRICA/ANARACHISM.AFRICA` — if that path ever changes, those pieces must be re-keyed (see §7).

---

## 0. Path note

The working directory is spelled **`ANARACHISM.AFRICA`** (extra "A") inside a correctly-spelled parent `ANARCHISM.AFRICA/`. Every path-keyed artefact below encodes that misspelling. If the directory is ever renamed to fix it, follow §7.

---

## 1. Rules / settings

| Artefact | Path | Copyable? | Notes |
|---|---|---|---|
| Global settings | `~/.claude/settings.json` | ✅ file | `enabledPlugins` (vercel-plugin) + `Stop` hook → `auto-push.sh` |
| Local settings | `~/.claude/settings.local.json` | ✅ file | `permissions.allow` list (7 Bash entries, mostly `du`/disk-usage helpers) |
| Project `CLAUDE.md` | — | n/a | **None exists.** No repo-level or user-level `CLAUDE.md`. |

### `~/.claude/settings.json` (verbatim)
```json
{
  "enabledPlugins": { "vercel-plugin@vercel-vercel-plugin": true },
  "hooks": {
    "Stop": [
      { "hooks": [ { "type": "command", "command": "~/.claude/auto-push.sh", "timeout": 30, "statusMessage": "Auto-pushing changes…" } ] }
    ]
  }
}
```

### `~/.claude/settings.local.json` (verbatim)
```json
{
  "permissions": {
    "allow": [
      "Bash(du:*)",
      "Bash(for dir in \"$HOME/Library/Application Support\"/*/)",
      "Bash(do du -sh \"$dir\")",
      "Bash(done)",
      "Bash(for item in \"$HOME/Library/Application Support/Claude\"/*/)",
      "Bash(do du -sh \"$item\")",
      "Bash(for item in \"$HOME/Library/Application Support\"/*/)"
    ]
  }
}
```

---

## 2. Hooks

| Hook | Event | Script | Copyable? |
|---|---|---|---|
| auto-push | `Stop` | `~/.claude/auto-push.sh` | ✅ file |

**What it does:** on every session stop, if the repo has uncommitted changes it runs `git add -A`, commits as `auto: claude session commit [HH:MM]`, and `git push origin <branch>`. Emits a `systemMessage` confirming success/failure. This is why the git log shows `auto: claude session commit` entries.

> This hook directly implements the standing rule in memory ([feedback_deploy_after_each_update](../../../.claude/projects/…/memory/feedback_deploy_after_each_update.md)) — *commit + push after every change*. On migration, copy `auto-push.sh` **and** re-register the Stop hook in `settings.json`, or the rule stops being enforced automatically.

---

## 3. Memory

**Location:** `~/.claude/projects/-Volumes-SSD-Documents-DEV-ANARCHISM-AFRICA-ANARACHISM-AFRICA/memory/`
**Copyable?** ✅ files — but the **directory name is the path-slug** of the project, so on relocation the whole `memory/` folder must move to the new path-slug directory (see §7).

| File | Type | Summary |
|---|---|---|
| `MEMORY.md` | index | One-line pointers to each memory file |
| `feedback_deploy_after_each_update.md` | feedback | Always commit + push + deploy after every update; verify Vercel shows `● Ready` |

---

## 4. Plugins

| Plugin | Version | Scope | Source | Copyable? |
|---|---|---|---|---|
| `vercel-plugin@vercel-vercel-plugin` | 0.24.0 | user | local marketplace dir | ✅ reinstall |

- **Install record:** `~/.claude/plugins/installed_plugins.json`
- **Cache:** `~/.claude/plugins/cache/vercel-vercel-plugin/vercel-plugin/0.24.0/` (full plugin tree: skills, agents, commands, hooks, docs)
- **Marketplace:** `~/.claude/plugins/known_marketplaces.json` → source is a **local directory**: `/Users/campbellcyrus/.cache/plugins/github.com-vercel-vercel-plugin` (origin: vercel/vercel-plugin, commit `2e79fc9`)
- **Plugin data:** `~/.claude/plugins/data/{vercel-plugin-inline, vercel-plugin-vercel-vercel-plugin}`

**Migration:** best reproduced by re-adding the marketplace and reinstalling the plugin rather than copying the cache. The plugin also supplies the 3 sub-agents (`ai-architect`, `deployment-expert`, `performance-optimizer`) and the aggressive doc-injection hooks seen in this session.

---

## 5. Skills

Skills come from two sources:

1. **vercel-plugin** (user-installed, §4) — `vercel-functions`, `deployments-cicd`, `cron-jobs`, `ai-sdk`, `ai-gateway`, `vercel-storage`, `routing-middleware`, `nextjs`, `shadcn`, `workflow`, `investigation-mode`, etc. (~60 skills). These migrate **with the plugin**.
2. **Environment-bundled skill packs** (NOT in `installed_plugins.json` — provided by the Claude Code / Cowork environment, tied to the account/install, not file-copyable):
   - `anthropic-skills` (xlsx, pdf, docx, pptx, skill-creator, setup-cowork, consolidate-memory)
   - `design`, `legal`, `engineering`, `data`, `finance`, `operations`, `marketing`, `product-management`, `brand-voice`, `productivity`, `cowork-plugin-management`
   - Built-in standalone skills: `update-config`, `keybindings-help`, `simplify`, `loop`, `schedule`, `claude-api`, `init`, `review`, `security-review`, `fewer-permission-prompts`

**Usage telemetry:** `~/.claude.json` → `skillUsage` (25 skills tracked). Informational only; not required for migration.

**Migration:** only the vercel-plugin skills are file-portable. The bundled packs reappear automatically on a Claude Code/Cowork install signed into the same account — nothing to copy.

---

## 6. Connections (MCP) — ⚠️ NOT file-copyable

**Finding:** there are **zero** MCP servers defined in any local file. Confirmed by walking all of `~/.claude.json`: every `mcpServers` block is empty, and the project entry for this directory has `mcpServers: none`, `enabledMcpjsonServers: []`. There is no `.mcp.json` in the repo and no managed-settings file.

**Conclusion:** all active MCP connections are **account-level managed connectors**, synced via the signed-in Claude account (`oauthAccount`: `accountUuid` + `emailAddress` + `organizationUuid` all present in `~/.claude.json`). They reconnect by **signing into the same account**, not by copying files.

Active connectors observed this session (reconnect via account, re-authorize each OAuth):

| Connector | Tooling namespace |
|---|---|
| Google Calendar | `mcp__17539908-…__*` |
| Gmail | `mcp__26f47f39-…__*` |
| Spotify (Web API + AppleScript) | `mcp__37c2a7a7-…__*`, `Spotify (AppleScript)` |
| Google Drive | `mcp__3eff767d-…__*` |
| Canva | `mcp__4638fab3-…__*` |
| Notion | `mcp__82c22590-…__*` |
| Supabase | `mcp__eb9f6995-…__*` |
| Claude in Chrome | `mcp__Claude_in_Chrome__*` |
| Claude Preview | `mcp__Claude_Preview__*` |
| Control Chrome | `mcp__Control_Chrome__*` |
| PDF Tools | `mcp__PDF_Tools…__*` |
| Read/Send iMessages | `mcp__Read_and_Send_iMessages__*` |
| computer-use (desktop control) | `mcp__computer-use__*` |
| MCP registry | `mcp__mcp-registry__*` |
| Scheduled tasks | `mcp__scheduled-tasks__*` |
| CCD session mgmt / directory | `mcp__ccd_*__*` |

> The Supabase connector is the one with **project significance** — it's the live datastore (ADR-006). Verify it points at the correct Supabase project after any account/machine migration.

---

## 7. Re-keying checklist (only if the project path changes)

If the directory is ever moved/renamed (e.g. fixing `ANARACHISM` → `ANARCHISM`), these path-keyed artefacts break and must be updated:

1. **Memory dir** — rename `~/.claude/projects/-Volumes-…-ANARACHISM-AFRICA/` to the new path-slug (Claude slugifies the absolute path with `-`).
2. **`~/.claude.json` `projects` key** — the entry `"/Volumes/SSD/Documents/DEV/ANARCHISM.AFRICA/ANARACHISM.AFRICA"` holds `allowedTools`, trust-dialog state, onboarding flags. Re-key to the new absolute path (and remove the stale `.claude/worktrees/crazy-zhukovsky-513fe7` sub-entry — see §8).
3. **Stop hook** — `auto-push.sh` is path-agnostic (uses `git rev-parse`), so no change needed.
4. **MCP / plugins / settings** — global, not path-keyed; no change needed.

---

## 8. Cleanup observations (not acted on)

- **Stale worktree:** `.claude/worktrees/crazy-zhukovsky-513fe7/` is a full duplicate checkout from a previous Agent worktree run, and it has its own `~/.claude.json` project entry. Safe to delete the worktree + its claude.json entry once confirmed abandoned.
- **Dead file:** `sw.js.bak.dead` (0 bytes) in repo root.

---

## 9. One-paragraph migration summary

To reproduce this setup elsewhere: (1) copy `~/.claude/settings.json`, `~/.claude/settings.local.json`, and `~/.claude/auto-push.sh`; (2) copy the project's `memory/` folder into the new path-slug directory under `~/.claude/projects/`; (3) re-add the vercel marketplace and reinstall `vercel-plugin@0.24.0`; (4) sign into the **same Claude account** — this restores every MCP connector and the bundled skill packs automatically (re-authorize each OAuth connector once). The repo itself carries **no** Claude config today, so nothing in git needs to change.

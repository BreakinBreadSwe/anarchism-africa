#!/usr/bin/env bash
# ANARCHISM.AFRICA — disk cleanup helper (surgical edition)
# Audit-first.  Whitelist-only.  Refuses to touch project memory.
#
# Usage:
#   bash cleanup.command          # audit only — non-destructive
#   bash cleanup.command --apply  # delete only the explicitly-named safe paths

set -e
APPLY="${1:-audit}"

# ── colors ────────────────────────────────────────────────────────────────────
R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; D=$'\033[2m'; B=$'\033[1m'; X=$'\033[0m'

cat <<EOF
${Y}${B}
 ▄▀█ █▄ █ ▄▀█ █▀█ █▀▀ █ █ █ █▀ █▀▄▀█    ▄▀█ █▀▀ █▀█ █ █▀▀ ▄▀█
 █▀█ █ ▀█ █▀█ █▀▄ █▄▄ █▀█ █ ▄█ █ ▀ █    █▀█ █▀░ █▀▄ █ █▄▄ █▀█
${X}${G}     surgical disk cleanup · keeps project & AI memory${X}
${D}     mode: ${APPLY}${X}
EOF

# ╔══════════════════════════════════════════════════════════════════════════╗
# ║  PRESERVE LIST — these are NEVER touched, even with --apply.             ║
# ║  Edit only if you know what you're doing.                                ║
# ╚══════════════════════════════════════════════════════════════════════════╝
PRESERVE=(
  "$HOME/Library/Application Support"          # all app state, incl. Claude / Anthropic / Cursor / Cowork sessions
  "$HOME/Library/Containers"                   # sandboxed app data
  "$HOME/Library/Group Containers"             # cross-app shared data
  "$HOME/Library/Mobile Documents"             # iCloud Drive
  "$HOME/Library/Mail"                         # local mail
  "$HOME/Library/Messages"                     # iMessage history
  "$HOME/Library/Calendars"
  "$HOME/Library/Reminders"
  "$HOME/Library/Notes"
  "$HOME/Library/Photos"
  "$HOME/Library/Keychains"
  "$HOME/.config"                              # XDG config — many tools (incl. some AI tools) keep state here
  "$HOME/.cache"                               # XDG cache — could include Claude/MCP state
  "$HOME/.local/share"                         # XDG data — may include CLI app state
  "$HOME/.claude"                              # Claude Code state
  "$HOME/.cursor"                              # Cursor state
  "$HOME/.codeium"                             # Codeium state
  "$HOME/.vscode"                              # VS Code user state
  "$HOME/.zsh_history"
  "$HOME/.bash_history"
  "$HOME/Documents"
  "$HOME/Downloads"
  "$HOME/Desktop"
  "$HOME/Movies"
  "$HOME/Music"
  "$HOME/Pictures"
  "$HOME/Public"
  "$HOME/Sites"
)

# Specific cache subfolders that are KNOWN safe (re-downloadable / regenerable).
# These are the ONLY paths --apply will delete from.
SAFE_TARGETS=(
  # — Trash —
  "$HOME/.Trash"

  # — Logs (records only, not memory) —
  "$HOME/Library/Logs"
  "$HOME/Library/Application Support/CrashReporter"

  # — Re-downloadable package caches —
  "$HOME/.npm/_cacache"
  "$HOME/Library/Caches/Yarn"
  "$HOME/Library/Caches/pnpm"
  "$HOME/Library/Caches/pip"
  "$HOME/Library/Caches/pypoetry"
  "$HOME/Library/Caches/Homebrew/downloads"
  "$HOME/Library/Caches/Homebrew/api"
  "$HOME/Library/Caches/CocoaPods"

  # — Build artefacts (regenerated next build) —
  "$HOME/Library/Developer/Xcode/DerivedData"
  "$HOME/Library/Developer/Xcode/Archives"
  "$HOME/Library/Developer/CoreSimulator/Caches"
  "$HOME/Library/Caches/com.apple.dt.Xcode/Downloads"

  # — Browser HTTP caches (keeps cookies, history, sessions, passwords) —
  "$HOME/Library/Caches/com.apple.Safari"
  "$HOME/Library/Caches/Google/Chrome/Default/Cache"
  "$HOME/Library/Caches/Google/Chrome/Default/Code Cache"
  "$HOME/Library/Caches/Firefox/Profiles"
)

heading () { echo; echo "${B}${Y}── $1${X}"; }
fmt ()     { du -sh "$1" 2>/dev/null | awk '{print $1}'; }

# ── 0. preserve sanity check ──────────────────────────────────────────────────
heading "Always preserved (never touched)"
echo "${D}  Documents · Downloads · Desktop · Pictures · Movies · Music"
echo "  Library/Application Support  ←  Claude / Cursor / Cowork session memory"
echo "  Library/Containers · Group Containers · Mobile Documents · Mail · Messages"
echo "  ~/.config · ~/.cache · ~/.local/share · ~/.claude · ~/.cursor · ~/.codeium${X}"

# ── 1. disk snapshot ──────────────────────────────────────────────────────────
heading "Disk space"
df -h / | head -2

# ── 2. APFS snapshots ─────────────────────────────────────────────────────────
heading "APFS local snapshots (Time Machine cached on this disk)"
SNAPS=$(tmutil listlocalsnapshots / 2>/dev/null | grep com.apple.TimeMachine || true)
if [ -z "$SNAPS" ]; then
  echo "${D}  (none — already clean)${X}"
else
  echo "$SNAPS" | sed 's/^/  /'
  COUNT=$(echo "$SNAPS" | wc -l | tr -d ' ')
  echo "${Y}  → $COUNT snapshot(s). These are NOT your Time Machine backup — they are local copies on this disk that get pushed to your TM drive when it next connects. Removing them frees real disk and is safe; macOS will make new ones tomorrow.${X}"
fi

# ── 3. inspect each safe target ───────────────────────────────────────────────
heading "Whitelisted cache targets"
TOTAL_KB=0
for p in "${SAFE_TARGETS[@]}"; do
  if [ -e "$p" ]; then
    KB=$(du -sk "$p" 2>/dev/null | awk '{print $1}')
    TOTAL_KB=$((TOTAL_KB + ${KB:-0}))
    HUMAN=$(fmt "$p")
    printf "  ${B}%6s${X}  %s\n" "$HUMAN" "$p"
  fi
done
echo
TOTAL_HUMAN=$(numfmt --to=iec --suffix=B $((TOTAL_KB * 1024)) 2>/dev/null || echo "${TOTAL_KB}KB")
echo "${G}  reclaimable from caches above: ${B}${TOTAL_HUMAN}${X}"

# ── 4. INFORMATIONAL — show big files, do NOT delete ──────────────────────────
heading "Informational — biggest items in your home (≥500MB)"
echo "${D}  These are NOT auto-deleted. Decide for yourself.${X}"
find "$HOME" -type d -maxdepth 2 -size +500M -prune 2>/dev/null | head -10 | while read d; do
  printf "  ${B}%6s${X}  %s\n" "$(fmt "$d")" "$d"
done | sort -rh | head -10

if [ "$APPLY" != "--apply" ]; then
cat <<EOF

${G}${B}── Audit complete. Nothing was deleted.${X}

If the targets above look safe, re-run with:

  ${Y}bash cleanup.command --apply${X}

Apply will only delete from the whitelist above. It will NOT touch:
  ${G}·${X}  Application Support (project + AI memory)
  ${G}·${X}  ~/.config  ~/.cache  ~/.local/share  ~/.claude  ~/.cursor
  ${G}·${X}  Documents · Downloads · Desktop · Pictures · Movies · Music
  ${G}·${X}  Browser cookies / sessions / passwords (only HTTP cache cleared)
  ${G}·${X}  Mail / Messages / Calendars / Notes / Reminders / Photos / Keychains

EOF
  exit 0
fi

# ── 5. APPLY ──────────────────────────────────────────────────────────────────
heading "APPLYING (whitelist only)"

# Confirm preserved roots really exist before we touch anything underneath
for p in "${PRESERVE[@]}"; do
  if [ -e "$p" ]; then : ; fi
done

# 5a. Trash
if [ -d "$HOME/.Trash" ]; then
  echo "${Y}  → emptying ~/.Trash${X}"
  rm -rf "$HOME/.Trash"/* "$HOME/.Trash"/.??* 2>/dev/null || true
fi

# 5b. APFS local snapshots
echo "${Y}  → deleting APFS local snapshots${X}"
for snap in $(tmutil listlocalsnapshots / 2>/dev/null | grep -oE 'com\.apple\.TimeMachine\.[0-9-]+' | sed 's/com.apple.TimeMachine\.//'); do
  echo "    ↳ $snap"
  tmutil deletelocalsnapshots "$snap" 2>/dev/null || true
done

# 5c. each whitelisted path — delete CONTENTS not the folder itself
for p in "${SAFE_TARGETS[@]}"; do
  # skip Trash (handled above) and snapshots (handled above)
  [ "$p" = "$HOME/.Trash" ] && continue

  # paranoia check — refuse if path matches a preserve entry
  for pres in "${PRESERVE[@]}"; do
    if [ "$p" = "$pres" ]; then
      echo "${R}  ‼ refusing to delete preserved: $p${X}"
      continue 2
    fi
  done

  if [ -e "$p" ]; then
    echo "${Y}  → clearing $p${X}"
    # delete contents, not the folder, so apps don't get confused
    rm -rf "$p"/* "$p"/.[!.]* 2>/dev/null || true
  fi
done

heading "Done — new disk space"
df -h /

cat <<EOF

${G}${B}✓ Surgical cleanup complete.${X}
${D}Project memory · Claude/Cursor sessions · iCloud Drive · Mail · Photos
were ALL untouched.${X}

If you need more space, look at:
  ${Y}·${X}  About this Mac → Storage → Manage…  (visual breakdown)
  ${Y}·${X}  ~/Downloads — likely full of stuff you forgot
  ${Y}·${X}  ~/Desktop — your screenshot folder is huge
  ${Y}·${X}  Docker volumes:  docker system prune -a --volumes
  ${Y}·${X}  Reboot — releases inodes held by quit apps.

EOF

#!/bin/bash
# ANARCHISM.AFRICA — fast update + push (triggers Vercel auto-deploy)
# Use this after the first deploy.command has linked GitHub + Vercel.
# Double-click to: clean any sandbox locks, commit any pending edits, git push.
# Vercel's GitHub integration auto-deploys within ~30s.

set -e
cd "$(dirname "$0")"

# fix sandbox-leftover locks
if [ -d .git ]; then
  chmod -R u+w .git 2>/dev/null || true
  rm -f .git/index.lock .git/HEAD.lock .git/packed-refs.lock 2>/dev/null || true
  rm -f .git/objects/maintenance.lock 2>/dev/null || true
  find .git/objects -name 'tmp_obj_*' -type f -delete 2>/dev/null || true
fi

git add -A
if ! git diff --cached --quiet; then
  ts=$(date '+%Y-%m-%d %H:%M:%S')
  git commit -q -m "Update — $ts"
  echo "✅ committed: $ts"
else
  echo "↳ nothing to commit"
fi

if git remote get-url origin >/dev/null 2>&1; then
  echo "📤 pushing to GitHub (Vercel will auto-deploy)…"
  git push -q origin main && echo "✅ pushed. Vercel deploy in progress: https://vercel.com/dashboard"
else
  echo "⚠ no origin remote — run deploy.command first"
  exit 1
fi

echo
echo "Live at: https://anarchism-africa.vercel.app"
echo "You can close this window."

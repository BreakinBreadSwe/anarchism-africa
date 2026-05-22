#!/bin/bash
# ANARCHISM.AFRICA — one-shot deploy
# Double-click this file from Finder. Terminal opens, this script runs.
# It pushes to GitHub and deploys to Vercel using your existing gh + vercel auth.
# After the first run, Vercel's GitHub integration auto-redeploys on every future push —
# so subsequent updates only need: git push.

set -e
cd "$(dirname "$0")"

# fix any permissions / locks left over from sandboxed editing sessions ----
if [ -d .git ]; then
  chmod -R u+w .git 2>/dev/null || true
  rm -f .git/index.lock .git/HEAD.lock .git/packed-refs.lock 2>/dev/null || true
  rm -f .git/objects/maintenance.lock 2>/dev/null || true
  # delete tmp_obj_* leftover from interrupted writes
  find .git/objects -name 'tmp_obj_*' -type f -delete 2>/dev/null || true
fi

cat <<'BANNER'

  █████╗  █████╗     █████╗ ███████╗██████╗ ██╗ ██████╗ █████╗
 ██╔══██╗██╔══██╗    ██╔══██╗██╔════╝██╔══██╗██║██╔════╝██╔══██╗
 ███████║███████║    ███████║█████╗  ██████╔╝██║██║     ███████║
 ██╔══██║██╔══██║    ██╔══██║██╔══╝  ██╔══██╗██║██║     ██╔══██║
 ██║  ██║██║  ██║    ██║  ██║██║     ██║  ██║██║╚██████╗██║  ██║
 ╚═╝  ╚═╝╚═╝  ╚═╝    ╚═╝  ╚═╝╚═╝     ╚═╝  ╚═╝╚═╝ ╚═════╝╚═╝  ╚═╝
                                            deploy → github + vercel

BANNER

# ---------- 0. prereqs --------------------------------------------------------
if ! command -v git >/dev/null;     then echo "❌ git not installed";    exit 1; fi
if ! command -v gh >/dev/null;      then echo "❌ gh CLI not installed.   brew install gh";    exit 1; fi
if ! command -v vercel >/dev/null;  then echo "ℹ️  installing vercel CLI…";  npm i -g vercel; fi

# auth checks
gh auth status >/dev/null 2>&1     || { echo "🔐 logging into GitHub…"; gh auth login; }
vercel whoami    >/dev/null 2>&1   || { echo "🔐 logging into Vercel…"; vercel login; }

# ---------- 1. git: ensure repo exists, commit any changes -------------------
if [ ! -d .git ]; then
  git init -q -b main
fi
git config user.email "${GIT_EMAIL:-info@luvlab.io}" 2>/dev/null
git config user.name  "${GIT_NAME:-LUVLAB}"          2>/dev/null

# stage and commit if anything changed
git add -A
if ! git diff --cached --quiet; then
  ts=$(date '+%Y-%m-%d %H:%M')
  git commit -q -m "Update — $ts"
  echo "✅ committed local changes"
else
  echo "↳ no local changes to commit"
fi

# ---------- 2. github: create repo on first run, push ------------------------
if ! git remote get-url origin >/dev/null 2>&1; then
  echo "📦 creating GitHub repo anarchism-africa…"
  gh repo create anarchism-africa --public --source=. --remote=origin --push
else
  echo "📤 pushing to GitHub…"
  git push -u origin main
fi
REPO_URL=$(gh repo view --json url -q .url)
echo "✅ GitHub: $REPO_URL"

# ---------- 3. vercel: link + deploy + env vars ------------------------------
if [ ! -d .vercel ]; then
  echo "🔗 linking Vercel project (accept defaults — project name 'anarchism-africa', root './' )"
  vercel link --yes --project anarchism-africa
fi

# env vars — only sets ones that are present in the local environment.
# Run with `GEMINI_API_KEY=... bash deploy.command` to push your key once.
push_env () {
  local var="$1"
  if [ -n "${!var}" ]; then
    echo "  → $var"
    echo "${!var}" | vercel env add "$var" production --force >/dev/null 2>&1 || true
    echo "${!var}" | vercel env add "$var" preview    --force >/dev/null 2>&1 || true
  fi
}

echo "🔑 syncing env vars (only the ones present in your shell):"
for v in GEMINI_API_KEY QWEN_API_KEY DEEPSEEK_API_KEY KIMI_API_KEY GLM_API_KEY YI_API_KEY ANTHROPIC_API_KEY OPENAI_API_KEY \
         BLOB_READ_WRITE_TOKEN PRINTFUL_API_KEY TEEMILL_API_KEY GELATO_API_KEY \
         SUPABASE_URL SUPABASE_ANON_KEY SUPABASE_SERVICE_ROLE NEON_DATABASE_URL ; do
  push_env "$v"
done

# enable Vercel Blob if not already (idempotent — fails silently if already linked)
echo "🗄  enabling Vercel Blob storage (skip if already linked)…"
vercel blob create anarchism-africa-blob 2>/dev/null || echo "  ↳ Blob store already exists or needs UI step (Storage → Blob)"

# deploy
echo "🚀 deploying to Vercel…"
URL=$(vercel deploy --prod --yes 2>&1 | tail -1)
echo "✅ live at: $URL"

# seed Blob with content (idempotent)
if [[ "$URL" == https://* ]]; then
  echo "🌱 seeding Vercel Blob with bundled content…"
  curl -s -X POST "$URL/api/blob/seed" | head -c 200
  echo
fi

cat <<DONE

────────────────────────────────────────────────────────────────
  Deploy complete.
  Public site:  $URL
  GitHub repo:  $REPO_URL
  Studio:       $URL/admin.html

  From here on, every \`git push\` auto-deploys via Vercel's GitHub integration.
  You can close this window.
────────────────────────────────────────────────────────────────

DONE

#!/usr/bin/env bash
# ANARCHISM.AFRICA — terminal CLI installer
# Usage: curl -sSL https://anarchism-africa.vercel.app/aa.sh | bash
# Or:    curl -sSL https://anarchism.africa/aa.sh | bash

set -e

HOST="${AA_HOST:-https://anarchism-africa.vercel.app}"

# colors
R=$'\033[31m'; G=$'\033[32m'; Y=$'\033[33m'; D=$'\033[2m'; B=$'\033[1m'; X=$'\033[0m'

cat <<EOF
${Y}${B}
 ▄▀█ █▄ █ ▄▀█ █▀█ █▀▀ █ █ █ █▀ █▀▄▀█    ▄▀█ █▀▀ █▀█ █ █▀▀ ▄▀█
 █▀█ █ ▀█ █▀█ █▀▄ █▄▄ █▀█ █ ▄█ █ ▀ █    █▀█ █▀░ █▀▄ █ █▄▄ █▀█
${X}${G}     installer · cli · pan-african · anti-state · pro-people${X}

EOF

# 1. node check
if ! command -v node >/dev/null 2>&1; then
  echo "${R}❌ node 18+ required.${X}"
  echo "${D}   install via: brew install node    (mac)${X}"
  echo "${D}             or: sudo apt install nodejs npm   (linux)${X}"
  exit 1
fi
NODE_MAJOR=$(node -v | sed 's/v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "${R}❌ node $NODE_MAJOR found, need 18+.${X}"
  exit 1
fi

# 2. pick install dir
if [ -w /usr/local/bin ] 2>/dev/null; then
  DEST=/usr/local/bin
else
  DEST="$HOME/.local/bin"
  mkdir -p "$DEST"
  case "$PATH" in
    *":$DEST:"*|"$DEST:"*|*":$DEST"*) ;;
    *) echo "${Y}↳ adding $DEST to PATH in your shell rc${X}"
       SHELL_RC="$HOME/.zshrc"; [ -f "$HOME/.bashrc" ] && SHELL_RC="$HOME/.bashrc"
       echo "" >> "$SHELL_RC"
       echo "# ANARCHISM.AFRICA" >> "$SHELL_RC"
       echo "export PATH=\"$DEST:\$PATH\"" >> "$SHELL_RC"
       ;;
  esac
fi

# 3. download aa.js
TMP=$(mktemp)
echo "${D}↳ downloading aa.js from $HOST/bin/aa.js${X}"
if command -v curl >/dev/null; then
  curl -fsSL "$HOST/bin/aa.js" -o "$TMP"
elif command -v wget >/dev/null; then
  wget -q "$HOST/bin/aa.js" -O "$TMP"
else
  echo "${R}❌ need curl or wget${X}"; exit 1
fi

# 4. install
mv "$TMP" "$DEST/aa"
chmod +x "$DEST/aa"

cat <<EOF

${G}✓ installed: $DEST/aa${X}

${B}now run:${X}    ${Y}aa${X}              ${D}# interactive launcher${X}
            ${Y}aa films${X}        ${D}# list films${X}
            ${Y}aa chat${X}         ${D}# A.A.AI in your terminal${X}
            ${Y}aa --help${X}       ${D}# everything else${X}

${D}reach: $HOST${X}
EOF

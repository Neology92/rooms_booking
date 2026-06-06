#!/bin/bash
# SessionStart hook — przygotowuje środowisko dla Claude Code (web).
# Idempotentny i nieinteraktywny. Instaluje zależności, gdy pojawi się stack
# (React/TS + Supabase wg CLAUDE.md §4). Dopóki kodu nie ma — kończy bez błędu.
set -euo pipefail

# Uruchamiaj tylko w środowisku zdalnym (Claude Code on the web).
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-.}"

# Frontend / Node — instaluj zależności, gdy istnieje manifest.
# (preferujemy `npm install`, by skorzystać z cache'owania stanu kontenera)
if [ -f package.json ]; then
  echo "[session-start] package.json wykryty — instaluję zależności npm..."
  npm install
else
  echo "[session-start] Brak package.json — nic do instalacji (projekt na etapie założeń)."
fi

# Tu w przyszłości: kolejne kroki setupu (np. env dla Supabase) — patrz CLAUDE.md.

echo "[session-start] Gotowe."

#!/usr/bin/env bash
# Reproduce the domain-verification race against a Postgres carrying this
# repo's schema (drizzle/0000_*.sql applied).
#
#   DATABASE_URL=postgres://user:pass@host:5432/db ./scripts/repro/run.sh
#   TRIALS=500 DATABASE_URL=... ./scripts/repro/run.sh
#
# --conditions=react-server + the resolve hook let plain Node import the real
# server-only application modules and the "@/..." path alias.
set -euo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?set DATABASE_URL to a Postgres with the repo schema applied}"

exec node \
  --conditions=react-server \
  --import ./node_modules/tsx/dist/loader.mjs \
  --import ./scripts/repro/hooks.mjs \
  ./scripts/repro/domain-verification-race.mts

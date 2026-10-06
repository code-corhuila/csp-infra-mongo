#!/usr/bin/env sh
# Creates the shared network (idempotent) and brings the MongoDB instance of an environment up, waiting until the
# replica set is PRIMARY. Usage: ./scripts/up.sh dev|qa|main
set -eu
cd "$(dirname "$0")/.."
env_name="${1:?usage: up.sh dev|qa|main}"
env_file="env/$env_name.env"
[ -f "$env_file" ] || { echo "missing $env_file: cp env/$env_name.env.example $env_file and fill it in"; exit 1; }
grep -q '^MONGO_KEYFILE=.' "$env_file" || { echo "MONGO_KEYFILE is empty in $env_file: openssl rand -base64 48 | tr -d '[:space:]'"; exit 1; }
docker network inspect platform >/dev/null 2>&1 || docker network create platform
docker compose --env-file "$env_file" up -d --wait mongodb
docker compose --env-file "$env_file" ps

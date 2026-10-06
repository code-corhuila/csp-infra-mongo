#!/usr/bin/env sh
# Stops the instance of an environment and KEEPS its volume: the volume is the history of the system (Annex J.5.4).
# There is no option to delete it here on purpose. Usage: ./scripts/down.sh dev|qa|main
set -eu
cd "$(dirname "$0")/.."
env_name="${1:?usage: down.sh dev|qa|main}"
docker compose --env-file "env/$env_name.env" down

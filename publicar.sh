#!/bin/bash
# Publica Class Drive: trae lo último de GitHub y despliega en Firebase.
# Uso:  ./publicar.sh            (usa la rama de trabajo actual)
#       ./publicar.sh main       (publica otra rama)
set -e
cd "$(dirname "$0")"
RAMA="${1:-claude/gifted-dijkstra-d32a7d}"
git fetch origin "$RAMA"
git checkout "$RAMA"
git pull origin "$RAMA"
firebase deploy --project classdrive-981c2 --only hosting
echo "Listo. Recarga el navegador con Cmd+Shift+R."

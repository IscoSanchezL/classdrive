#!/bin/bash
# Publica Class Drive: trae lo último de GitHub y despliega en Firebase.
# Uso:  ./publicar.sh            (publica la rama main)
#       ./publicar.sh otra-rama  (publica otra rama)
set -e
cd "$(dirname "$0")"
RAMA="${1:-main}"
git fetch origin "$RAMA"
git checkout "$RAMA"
git pull origin "$RAMA"
firebase deploy --project classdrive-981c2 --only hosting
echo "Listo. Recarga el navegador con Cmd+Shift+R."

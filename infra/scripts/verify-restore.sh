#!/usr/bin/env bash
# Prueba de restauracion del ultimo dump en una base temporal aislada.
set -euo pipefail
[[ $EUID -eq 0 ]] || exit 1
cd /opt/crm-lab
backup=$(find /var/backups/crm-lab -maxdepth 1 -type f -name '*.dump' | sort | tail -n 1)
[[ -n $backup ]] || { echo 'No hay dump local.' >&2; exit 1; }
restore_db="crm_restore_$(date +%s%N)"
docker compose exec -T db createdb --username=postgres --template=template0 "$restore_db"
trap 'docker compose exec -T db dropdb --username=postgres --if-exists "$restore_db"' EXIT
docker compose exec -T db pg_restore --username=postgres --dbname="$restore_db" --exit-on-error < "$backup"
docker compose exec -T db psql --username=postgres --dbname="$restore_db" --set=ON_ERROR_STOP=1 --command='SELECT current_database(), version();'
echo 'Restauracion local verificada; no reemplaza una prueba de recuperacion completa fuera del VPS.'

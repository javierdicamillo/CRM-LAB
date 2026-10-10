#!/usr/bin/env bash
set -euo pipefail
[[ $EUID -eq 0 ]] || exit 1
export RESTIC_REPOSITORY=/var/backups/crm-lab-restic
export RESTIC_PASSWORD_FILE=/opt/crm-lab/secrets/restic_password
restic check
destination=$(mktemp -d /var/backups/crm-lab/restore-check-XXXXXX)
chmod 700 "$destination"
restic restore latest --tag crm-lab --target "$destination"
cd /opt/crm-lab
restore_db="crm_restore_$(date +%s%N)"
docker compose exec -T db createdb -U postgres -T template0 "$restore_db"
cleanup() {
  docker compose exec -T db dropdb -U postgres --if-exists "$restore_db"
  # Directorio temporal generado por este script dentro de la ruta prevista.
  [[ $destination == /var/backups/crm-lab/restore-check-* ]] && rm -rf -- "$destination"
}
trap cleanup EXIT
docker compose exec -T db pg_restore -U postgres -d "$restore_db" --exit-on-error < "$destination/var/backups/crm-lab/current.dump"
docker compose exec -T db psql -U postgres -d "$restore_db" -v ON_ERROR_STOP=1 -c 'SELECT count(*) AS registros FROM records;'
test -s "$destination/opt/crm-lab/secrets/app.env"
test -s "$destination/opt/crm-lab/Caddyfile"
while IFS= read -r photo; do
  [[ -z $photo ]] && continue
  test -s "$destination/opt/crm-lab/uploads/$photo.webp"
  test -s "$destination/opt/crm-lab/uploads/$photo.original"
done < <(docker compose exec -T db psql -U postgres -d "$restore_db" -Atc 'SELECT id FROM photos')
echo 'SQL, configuracion, secretos y fotos referenciadas recuperables desde el snapshot local.'

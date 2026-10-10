#!/usr/bin/env bash
# Respaldo local completo cifrado. Requiere una copia externa antes de produccion real.
set -euo pipefail
umask 077
exec 9>/run/lock/crm-lab-backup.lock
flock -n 9 || exit 0
cd /opt/crm-lab
export RESTIC_REPOSITORY=/var/backups/crm-lab-restic
export RESTIC_PASSWORD_FILE=/opt/crm-lab/secrets/restic_password
test -s "$RESTIC_PASSWORD_FILE" || openssl rand -hex 32 > "$RESTIC_PASSWORD_FILE"
test -e "$RESTIC_REPOSITORY/config" || restic init
install -d -m 700 /var/backups/crm-lab
dump=/var/backups/crm-lab/current.dump
trap 'rm -f /var/backups/crm-lab/current.dump.partial' EXIT
docker compose exec -T db pg_dump -U postgres -d crm_lab -Fc > "$dump.partial"
docker compose exec -T db pg_restore --list < "$dump.partial" > /dev/null
mv "$dump.partial" "$dump"
# Fotos se escriben antes de confirmar su fila SQL y no se borran en este MVP.
restic backup --tag crm-lab "$dump" /opt/crm-lab/uploads /opt/crm-lab/secrets \
  /opt/crm-lab/.env /opt/crm-lab/compose.yaml /opt/crm-lab/compose.app.yaml /opt/crm-lab/Caddyfile
restic forget --tag crm-lab --keep-within 7d --keep-daily 14 --keep-monthly 3
echo 'Respaldo local completo terminado. El repositorio permanece en este VPS.'

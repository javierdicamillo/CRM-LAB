#!/usr/bin/env bash
# Copia local de PostgreSQL: NO protege ante perdida del VPS.
set -euo pipefail
umask 077
exec 9>/run/lock/crm-lab-backup.lock
flock -n 9 || exit 0
cd /opt/crm-lab
install -d -m 700 /var/backups/crm-lab
backup=/var/backups/crm-lab/$(date -u +%Y%m%dT%H%M%SZ).dump
trap 'rm -f -- "${backup}.partial"' EXIT
docker compose exec -T db pg_dump --username=postgres --dbname=crm_lab --format=custom > "${backup}.partial"
docker compose exec -T db pg_restore --list < "${backup}.partial" > /dev/null
mv -- "${backup}.partial" "$backup"
# Retencion de 7 dias, exclusivamente los dumps de este directorio.
find /var/backups/crm-lab -maxdepth 1 -type f -name '*.dump' -mmin +10080 -delete
echo 'Copia local de PostgreSQL completada.'

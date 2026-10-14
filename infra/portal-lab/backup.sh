#!/bin/bash
set -euo pipefail
umask 077
cd "$(dirname "$(readlink -f "$0")")"
backup_dir=/opt/portal-lab/backups
mkdir -p "$backup_dir"
backup_file="$backup_dir/portal-$(date -u +%Y%m%dT%H%M%SZ).dump"
trap 'rm -f "$backup_file.partial"' EXIT
docker compose exec -T db pg_dump -U postgres -d portal_lab -Fc > "$backup_file.partial"
docker compose exec -T db pg_restore --list < "$backup_file.partial" >/dev/null
mv "$backup_file.partial" "$backup_file"
# Keep two weeks of daily local backups; external backup is configured separately.
find "$backup_dir" -maxdepth 1 -type f -name 'portal-*.dump' -mtime +14 -delete
printf 'Backup created: %s\n' "$backup_file"

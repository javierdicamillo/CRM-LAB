#!/usr/bin/env bash
# Ejecutar una vez en el piloto; secretos permanecen fuera del codigo y de stdout.
set -euo pipefail
domain=${1:?Dominio de la instalacion}
agency=${2:?Nombre de la inmobiliaria}
bootstrap_email=${3:?Correo del primer administrador}
[[ $domain =~ ^[a-z0-9.-]+$ && $bootstrap_email != *[[:space:]]* ]] || exit 1
cd /opt/crm-lab
umask 077
test -s secrets/app_password || openssl rand -hex 32 > secrets/app_password
if [[ ! -s secrets/app.env ]]; then
  {
    printf 'DATABASE_URL=postgresql://crm_app:%s@db:5432/crm_lab\n' "$(cat secrets/app_password)"
    printf 'BETTER_AUTH_URL=https://%s\nBETTER_AUTH_SECRET=%s\n' "$domain" "$(openssl rand -hex 48)"
    printf 'BOOTSTRAP_TOKEN=%s\n' "$(openssl rand -hex 32)"
    printf 'BOOTSTRAP_EMAIL=%s\nUPLOAD_DIR=/data/uploads\n' "$bootstrap_email"
    printf 'PORTAL_URL=\nPORTAL_TOKEN=\nPORTAL_INSTANCE_ID=\n'
  } > secrets/app.env
fi
if [[ ! -s secrets/app-test.env ]]; then
  {
    printf 'DATABASE_URL=postgresql://crm_app:%s@db:5432/crm_lab_test\n' "$(cat secrets/app_password)"
    printf 'BETTER_AUTH_URL=http://localhost:3001\nBETTER_AUTH_SECRET=%s\n' "$(openssl rand -hex 48)"
    printf 'BOOTSTRAP_TOKEN=%s\n' "$(openssl rand -hex 32)"
    printf 'UPLOAD_DIR=/data/uploads\nTARGET_DATABASE=crm_lab_test\n'
  } > secrets/app-test.env
fi
install -d -m 700 -o 1000 -g 1000 uploads uploads-test
for target in crm_lab crm_lab_test; do
  docker run --rm --network crm-lab_database --user 0 \
    -e TARGET_DATABASE="$target" -e AGENCY_NAME="$agency" \
    -e ADMIN_PASSWORD_FILE=/secrets/postgres_password -e APP_PASSWORD_FILE=/secrets/app_password \
    -v /opt/crm-lab/secrets:/secrets:ro crm-lab:0.1.0 node scripts/provision.mjs
done
echo 'Produccion y base de prueba preparadas. Ningun secreto se imprimio.'

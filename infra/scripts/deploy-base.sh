#!/usr/bin/env bash
# Los archivos compose.yaml y Caddyfile deben estar en /opt/crm-lab.
set -euo pipefail
[[ $EUID -eq 0 ]] || exit 1
cd /opt/crm-lab
umask 077
install -d -m 700 secrets
if [[ ! -s secrets/postgres_password ]]; then
  openssl rand -hex 32 > secrets/postgres_password
fi
if [[ ! -s .env ]]; then
  docker pull postgres:18
  docker pull caddy:2
  postgres_image=$(docker image inspect postgres:18 --format '{{index .RepoDigests 0}}')
  caddy_image=$(docker image inspect caddy:2 --format '{{index .RepoDigests 0}}')
  printf 'POSTGRES_IMAGE=%s\nCADDY_IMAGE=%s\n' "$postgres_image" "$caddy_image" > .env
fi
docker compose config --quiet
docker compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
docker compose up --detach --wait --wait-timeout 180
docker compose ps

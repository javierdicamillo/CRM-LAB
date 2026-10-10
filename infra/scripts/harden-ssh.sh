#!/usr/bin/env bash
# Ejecutar SOLO despues de verificar acceso por clave y sudo como crmadmin.
set -euo pipefail
[[ $EUID -eq 0 ]] || exit 1
test -s /home/crmadmin/.ssh/authorized_keys
test ! -e /etc/ssh/sshd_config.d/00-crm-lab.conf || cp -a /etc/ssh/sshd_config.d/00-crm-lab.conf /etc/ssh/sshd_config.d/00-crm-lab.conf.previous
cat > /etc/ssh/sshd_config.d/00-crm-lab.conf <<'EOF'
PubkeyAuthentication yes
PasswordAuthentication no
KbdInteractiveAuthentication no
PermitRootLogin prohibit-password
MaxAuthTries 3
X11Forwarding no
EOF
sshd -t
systemctl reload ssh
ufw default deny incoming
ufw default allow outgoing
ufw limit 22/tcp comment 'SSH con clave'
ufw allow 80/tcp comment 'HTTP Caddy'
ufw allow 443/tcp comment 'HTTPS Caddy'
ufw --force enable
ufw status verbose
# Los puertos publicados por Docker atraviesan UFW. No publicar PostgreSQL.
sshd -T | grep -E '^(permitrootlogin|passwordauthentication|pubkeyauthentication|kbdinteractiveauthentication) '

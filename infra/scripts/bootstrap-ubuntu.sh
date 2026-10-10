#!/usr/bin/env bash
# Ejecutar como root en un VPS nuevo, luego de inspeccionarlo.
set -euo pipefail
export DEBIAN_FRONTEND=noninteractive
[[ $EUID -eq 0 ]] || { echo 'Se requiere root.' >&2; exit 1; }
. /etc/os-release
[[ $ID == ubuntu && ( $VERSION_ID == 24.04 || $VERSION_ID == 26.04 ) ]] || exit 1
public_key=${1:?Indicar archivo de clave publica autorizado}
ssh-keygen -lf "$public_key" >/dev/null

apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg ufw sudo restic unattended-upgrades

if ! id crmadmin >/dev/null 2>&1; then
  useradd --create-home --shell /bin/bash crmadmin
fi
install -d -m 700 -o crmadmin -g crmadmin /home/crmadmin/.ssh
touch /home/crmadmin/.ssh/authorized_keys
while IFS= read -r key || [[ -n $key ]]; do
  [[ -n $key ]] || continue
  grep -qxF "$key" /home/crmadmin/.ssh/authorized_keys || printf '%s\n' "$key" >> /home/crmadmin/.ssh/authorized_keys
done < "$public_key"
chown crmadmin:crmadmin /home/crmadmin/.ssh/authorized_keys
chmod 600 /home/crmadmin/.ssh/authorized_keys
printf 'crmadmin ALL=(ALL) NOPASSWD: ALL\n' > /etc/sudoers.d/crm-lab-admin
chmod 440 /etc/sudoers.d/crm-lab-admin
visudo -cf /etc/sudoers.d/crm-lab-admin

install -m 0755 -d /etc/apt/keyrings
curl --fail --silent --show-error --location https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod 644 /etc/apt/keyrings/docker.asc
cat > /etc/apt/sources.list.d/docker.sources <<EOF
Types: deb
URIs: https://download.docker.com/linux/ubuntu
Suites: ${UBUNTU_CODENAME:-$VERSION_CODENAME}
Components: stable
Architectures: $(dpkg --print-architecture)
Signed-By: /etc/apt/keyrings/docker.asc
EOF
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
install -d -m 755 /etc/docker
if [[ ! -e /etc/docker/daemon.json ]]; then
  cat > /etc/docker/daemon.json <<'EOF'
{"log-driver":"local","log-opts":{"max-size":"10m","max-file":"3"}}
EOF
  systemctl restart docker
fi
systemctl enable --now docker

if [[ $(swapon --noheadings --show | wc -l) -eq 0 && ! -e /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  printf '/swapfile none swap sw 0 0\n' >> /etc/fstab
  printf 'vm.swappiness=10\n' > /etc/sysctl.d/70-crm-lab.conf
  sysctl -p /etc/sysctl.d/70-crm-lab.conf
fi
install -d -m 755 /etc/systemd/journald.conf.d
printf '[Journal]\nSystemMaxUse=200M\n' > /etc/systemd/journald.conf.d/crm-lab.conf
systemctl restart systemd-journald
install -d -m 750 -o root -g crmadmin /opt/crm-lab
install -d -m 700 /opt/crm-lab/secrets /var/backups/crm-lab
docker --version
docker compose version
echo 'Base instalada. Probar crmadmin y sudo en otra conexion antes de endurecer SSH.'

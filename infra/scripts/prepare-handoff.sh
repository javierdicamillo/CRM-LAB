#!/usr/bin/env bash
# Crea material privado para el titular, no para Git ni para la web publica.
set -euo pipefail
[[ $EUID -eq 0 ]] || exit 1
umask 077
install -d -m 700 -o crmadmin -g crmadmin /home/crmadmin/crm-handoff
python3 - <<'PY'
from pathlib import Path
import html
values = dict(line.split('=', 1) for line in Path('/opt/crm-lab/secrets/app.env').read_text().splitlines() if '=' in line and not line.startswith('#'))
url = values['BETTER_AUTH_URL'].rstrip('/') + '/#activar=' + values['BOOTSTRAP_TOKEN']
email = html.escape(values.get('BOOTSTRAP_EMAIL', ''))
page = '''<!doctype html><html lang="es"><meta charset="utf-8"><meta name="referrer" content="no-referrer"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Activar CRM-LAB</title><style>body{font:18px system-ui;background:#f4f6f2;color:#18392e;max-width:650px;margin:12vh auto;padding:30px;line-height:1.6}a{display:inline-block;background:#1d573f;color:white;padding:14px 24px;border-radius:10px;text-decoration:none}small{display:block;margin-top:28px;color:#586b61}</style><h1>Activá inmolab</h1><p>Tu CRM ya está instalado. Abrí el formulario seguro, completá tu nombre y elegí una contraseña de al menos 12 caracteres.</p><p>Correo reservado: <strong>EMAIL</strong></p><a href="URL" rel="noreferrer">Abrir activación privada</a><small>Este archivo contiene un enlace de activación de un solo uso. Guardalo de forma privada; no lo subas a GitHub ni lo compartas en el grupo del laboratorio. No envíes tu contraseña por chat. Después de activar, ingresá normalmente a open-crm.tech.</small></html>'''
Path('/home/crmadmin/crm-handoff/ACTIVAR-CRM.html').write_text(page.replace('EMAIL', email).replace('URL', html.escape(url, quote=True)), encoding='utf-8')
PY
exec 9>/run/lock/crm-lab-backup.lock
flock 9
tar -C /var/backups -czf /home/crmadmin/crm-handoff/respaldo-inicial-restic.tar.gz crm-lab-restic
cp /opt/crm-lab/secrets/restic_password /home/crmadmin/crm-handoff/clave-restic.txt
chown crmadmin:crmadmin /home/crmadmin/crm-handoff/*
chmod 600 /home/crmadmin/crm-handoff/*
cd /home/crmadmin/crm-handoff
sha256sum respaldo-inicial-restic.tar.gz > respaldo-inicial.sha256
chown crmadmin:crmadmin respaldo-inicial.sha256
echo 'Material privado preparado; ningun secreto se imprimio.'

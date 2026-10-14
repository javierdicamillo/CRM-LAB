# Operación de PORTAL-LAB en Hostinger

Estado al 13 de octubre de 2026 (Argentina): aplicación y PostgreSQL saludables en el VPS, proxy público iniciado; publicación por dominio y HTTPS pendientes del cambio DNS.

- VPS: `srv2059603.hstgr.cloud`, IPv4 `179.236.76.161`.
- Código desplegado: `/opt/portal-lab/source`; Compose en `infra/portal-lab`.
- Dominio principal: `lotea.net`. `www.lotea.net`, `portal-neuquen.tech` y `www.portal-neuquen.tech` redirigen al principal.
- DNS necesario: A `@` a la IPv4 del VPS en ambos dominios; CNAME `www` al dominio correspondiente. Preservar MX, TXT y registros de correo. Revisar cualquier AAAA antes de activar HTTPS.
- Caddy obtiene y renueva certificados automáticamente cuando todos los nombres resuelven al VPS. No considerar HTTPS listo hasta verificarlo externamente.
- Imagen de aplicación: `portal-lab:0.1.0`; PostgreSQL, Node y Caddy fijados por digest.
- Credenciales exclusivamente en `secrets/`, permisos 600; nunca incorporarlas al repositorio. `portal_owner` ejecuta migraciones; `portal_app` tiene permisos de datos, sin superusuario ni creación de bases o roles.
- PostgreSQL y la aplicación no publican sus puertos al host; Caddy publica 80/443.
- Catálogo sin datos ficticios. Falta vincular las instalaciones CRM reales con sus credenciales individuales; el CRM de producción no se modificó durante este despliegue.

## Comprobaciones realizadas

`/`, `/territorio`, `/territorio/fuentes`, `/privacidad`, `/healthz` y la imagen principal responden 200 dentro del VPS. El acceso HTTP público al VPS con Host `lotea.net` redirige a HTTPS. Se creó una copia PostgreSQL y se restauró en una base temporal; esa base se eliminó después de la comprobación.

## Copias y mantenimiento

`backup.sh` produce copias PostgreSQL en formato custom, con permisos privados, en `/opt/portal-lab/backups`; conserva 14 días. `/etc/cron.d/portal-lab` ejecuta copias a las 06:20 UTC y mantenimiento a las 06:35 UTC. Los registros están en `/var/log/portal-backup.log` y `/var/log/portal-maintenance.log`.

Las copias están en el mismo VPS; no sustituyen una copia externa. El respaldo externo automático sigue pendiente.

## Administración

El acceso SSH utilizado es por clave en el puerto 2222; fue iniciado como listener temporal. El servicio principal de SSH en el puerto 22 no respondió desde el entorno de despliegue. Antes de reiniciar el VPS, confirmar acceso por consola de Hostinger o configurar un servicio persistente para el acceso alternativo.

Desde el directorio Compose:

```sh
docker compose ps
docker compose logs --tail=100 app caddy
./backup.sh
docker compose exec -T app node dist/maintenance.js
```

Para migrar con el propietario de esquema:

```sh
docker run --rm --network portal-lab_database --env-file secrets/migration.env portal-lab:0.1.0 node dist/migrate.js
```

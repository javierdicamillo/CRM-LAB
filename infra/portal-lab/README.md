# Operación de PORTAL-LAB en Hostinger

Estado al 14 de octubre de 2026 (Argentina): publicado en https://portal-neuquen.tech con HTTPS válido y redirección HTTPS de www al dominio principal. DNS A actualizado a 179.236.76.161 (TTL 60); contacto público info@portal-neuquen.tech. Aplicación y PostgreSQL saludables.

- VPS: `srv2059603.hstgr.cloud`, IPv4 `179.236.76.161`.
- Código desplegado: `/opt/portal-lab/source`; Compose en `infra/portal-lab`.
- Único dominio del portal: `portal-neuquen.tech`; `www.portal-neuquen.tech` redirige al principal. `lotea.net` se retiró de la configuración del VPS, sin cancelar su registro ni modificar sus servicios de correo.
- DNS necesario: A `@` a la IPv4 del VPS en `portal-neuquen.tech`; CNAME `www` al dominio correspondiente. Preservar MX, TXT y registros de correo. Revisar cualquier AAAA antes de activar HTTPS.
- Caddy obtiene y renueva certificados automáticamente cuando todos los nombres resuelven al VPS. No considerar HTTPS listo hasta verificarlo externamente.
- Imagen de aplicación: `portal-lab:0.1.0`; PostgreSQL, Node y Caddy fijados por digest.
- Credenciales exclusivamente en `secrets/`, permisos 600; nunca incorporarlas al repositorio. `portal_owner` ejecuta migraciones; `portal_app` tiene permisos de datos, sin superusuario ni creación de bases o roles.
- PostgreSQL y la aplicación no publican sus puertos al host; Caddy publica 80/443.
- Catálogo sin datos ficticios. Falta vincular las instalaciones CRM reales con sus credenciales individuales; el CRM de producción no se modificó durante este despliegue.

## Comprobaciones realizadas

`/`, `/territorio`, `/territorio/fuentes`, `/privacidad`, `/healthz` y la imagen principal responden 200 dentro del VPS. El acceso HTTP público al VPS con Host `portal-neuquen.tech` redirige a HTTPS. Se verificaron externamente la portada, /healthz, el contacto de privacidad y la redirección www, además de abrir la portada en el navegador. Se creó una copia PostgreSQL y se restauró en una base temporal; esa base se eliminó después de la comprobación.

## Copias y mantenimiento

`backup.sh` produce copias PostgreSQL en formato custom, con permisos privados, en `/opt/portal-lab/backups`; conserva 14 días. `/etc/cron.d/portal-lab` ejecuta copias a las 06:20 UTC y mantenimiento a las 06:35 UTC. Los registros están en `/var/log/portal-backup.log` y `/var/log/portal-maintenance.log`.

Las copias están en el mismo VPS; no sustituyen una copia externa. El respaldo externo automático sigue pendiente.

## Administración

El acceso SSH por clave en el puerto 22 quedó verificado con la clave de host previamente comprobada. Se cerró el listener temporal del puerto 2222 después de verificar el acceso por el puerto principal.

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

# Infraestructura de CRM-LAB

Ocho VPS CRM y un VPS portal. No se incluyen scripts que contraten servidores ni configuraciones que aparenten un despliegue funcional.

## Autorización de gastos

Por instrucción del titular del proyecto, avisar antes de contratar cualquier servicio o generar un cargo y esperar su autorización explícita. Esta condición incluye nuevos VPS, ampliaciones de planes, dominios, respaldos pagos y servicios externos. El presupuesto de ocho VPS nuevos no autoriza su compra.

La preparación y el despliegue piloto se realizaron sobre el VPS existente de Hostinger. Revisar primero el sistema y los servicios existentes; no reinstalar el sistema operativo ni eliminar datos para preparar CRM-LAB.

## Componentes previstos

- CRM: imagen CRM-LAB, ejecutor de sincronización de la misma imagen, PostgreSQL, Caddy y volúmenes privados.
- Portal: imagen PORTAL-LAB, ejecutor de trabajos, PostgreSQL, Caddy y volumen de fotos públicas.
- Administración: Ansible desde una estación autorizada, sin servidor de control permanente.
- Respaldo: exportaciones consistentes PostgreSQL y archivos con restic hacia repositorios separados fuera de los VPS.

La base del primer CRM ya tiene [Compose](crm-base/compose.yaml) y [scripts](scripts/bootstrap-ubuntu.sh), sin secretos. CRM-LAB 0.1.0 está desplegado; PORTAL-LAB sigue pendiente. Ver la [entrega operativa](../docs/09-entrega-crm-mvp.md), que amplía estos pasos de preparación con aplicación, worker, migraciones y respaldo completo. El instalador resuelve imágenes oficiales y guarda sus digests en el `.env` privado del servidor; las siguientes ejecuciones conservan esos digests. Inventario real, claves SSH y secretos de backup permanecen fuera del repositorio público. Cada inmobiliaria tendrá acceso a su infraestructura y recuperación.

## Preparación de otro VPS

1. Inspeccionar el servidor, sus datos y servicios. Estos scripts se diseñaron para un Ubuntu nuevo de 24.04 o 26.04 LTS; no sustituyen una migración de un servidor existente.
2. Copiar `scripts/bootstrap-ubuntu.sh`, `scripts/harden-ssh.sh` y la clave **pública** autorizada. Ejecutar bootstrap como root con la ruta de esa clave como argumento.
3. Abrir una conexión nueva como `crmadmin` y comprobar `sudo -n id`. Solo después ejecutar `harden-ssh.sh`. Conservar acceso a la consola del proveedor para recuperación.
4. Copiar `crm-base/compose.yaml` y `crm-base/Caddyfile` a `/opt/crm-lab/`. Ejecutar `scripts/deploy-base.sh` como root. La clave de PostgreSQL se genera en el VPS, nunca en el repositorio.
5. Instalar `backup-local.sh` como `/usr/local/sbin/crm-lab-backup`, modo 750. Copiar los archivos `.service` y `.timer` de `crm-base` a `/etc/systemd/system/`, recargar systemd y habilitar `crm-lab-backup.timer`. Ejecutar una copia y `scripts/verify-restore.sh`.
6. Aplicar actualizaciones de Ubuntu, reiniciar si corresponde y verificar SSH, firewall, persistencia de PostgreSQL y respuesta web.
7. Completar DNS y HTTPS antes de incorporar la aplicación. Definir y probar respaldo externo antes de usar datos reales.

Para HTTPS: verificar que A apunte al VPS y que no exista un AAAA incorrecto, y crear `www` como CNAME al dominio principal si se usa el alias. Agregar `CRM_DOMAIN=dominio-real` al `.env` privado, guardar copia del Caddyfile HTTP y sustituirlo por `crm-base/Caddyfile.https`. Validar con `docker compose run --rm --no-deps caddy caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile` y aplicar con `docker compose up -d --wait`. Esto recrea Caddy para cargar su variable de entorno. En el piloto, la validación de certificados y redirecciones ya se completó.

`crmadmin` administra mediante sudo sin contraseña; su clave equivale a acceso administrativo. No se agrega al grupo Docker. Root conserva acceso por clave para recuperación; el acceso SSH por contraseña se deshabilita. La contraseña root sigue siendo útil en la consola del proveedor.

El firewall permite SSH con límite de conexiones, HTTP y HTTPS. **Docker puede saltarse reglas UFW al publicar puertos**: PostgreSQL no publica ninguno y utiliza una red interna. No agregar `5432:5432` al Compose. No hay restricción de SSH por IP de origen todavía.

El piloto sustituyó el backup inicial por `backup-app.sh`: dump, fotos, configuración y secretos en restic cifrado cada seis horas. La restauración se validó sobre la instalación vacía. Se descargó una copia inicial al equipo del titular, pero no hay destino externo automático contratado ni configurado. La prueba de restauración crea y elimina exclusivamente su propia base temporal. Retención, límites y recuperación se documentan en la entrega operativa.

El script bootstrap no actualiza una versión mayor de Ubuntu. Las imágenes no se actualizan automáticamente: probar y fijar un nuevo digest para cada actualización. Antes de uso productivo, convertir este bootstrap piloto en roles Ansible con inventario privado, pruebas y despliegue gradual.

Fuentes: [Docker en Ubuntu](https://docs.docker.com/engine/install/ubuntu/), [imagen oficial PostgreSQL](https://hub.docker.com/_/postgres), [imagen oficial Caddy](https://hub.docker.com/_/caddy).

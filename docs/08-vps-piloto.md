# Primer VPS CRM-LAB — registro del laboratorio

Registro de la etapa de infraestructura, 9 de octubre de 2026. **Esta sección histórica describe el estado anterior al despliegue de la aplicación; consultar la [entrega actual](09-entrega-crm-mvp.md).** Estado al terminar esa etapa: base del servidor instalada y verificada después de reiniciar; DNS corregido y certificados HTTPS emitidos y comprobados. La propagación de cachés DNS continúa.

## Alcance

El titular contrató un VPS y un dominio. La intervención prepara ese servidor para el primer CRM de una inmobiliaria. No se contrataron servicios adicionales, no se reinstaló Ubuntu y se conservó el agente Monarx existente. El proyecto todavía no tiene aplicación CRM, autenticación de usuarios, migraciones de negocio ni integración con el portal.

## Configuración aplicada

| Componente | Resultado |
| --- | --- |
| Sistema | Ubuntu 26.04.1 LTS, 1 vCPU, aproximadamente 4 GB RAM y 50 GB disco |
| Administración | Usuario `crmadmin` con clave SSH y sudo; acceso SSH por contraseña deshabilitado |
| Firewall | UFW activo para IPv4 e IPv6; SSH limitado, HTTP y HTTPS permitidos |
| Contenedores | Docker Engine 29.9.0 y Compose 5.6.0 desde repositorio oficial |
| Base | PostgreSQL 18.6, volumen persistente, red interna, sin puerto publicado |
| Web | Caddy 2.11.7, HTTPS con Let's Encrypt; respuesta temporal 503 y `/healthz` con 200 |
| Memoria y logs | 2 GB swap; logs Docker rotados y journal limitado a 200 MB |
| Copias | Dump local cada seis horas UTC, retención de siete días, directorio root privado |
| Restic | Instalado, sin repositorio externo configurado |
| Actualizaciones | Paquetes Ubuntu actualizados; temporizador de actualizaciones de seguridad habilitado |

Caddy devuelve 503 intencionalmente porque aún no existe una aplicación disponible. `/healthz` comprueba solo el servicio web, no la salud de un CRM ni de su sincronización. La configuración inicial HTTP no transmite credenciales ni datos de clientes.

Las imágenes se fijaron por digest en `/opt/crm-lab/.env`; la contraseña de PostgreSQL se generó en `/opt/crm-lab/secrets/postgres_password`, con permisos restringidos. No usar la cuenta PostgreSQL administradora en la futura aplicación: crear un rol de ejecución de privilegios mínimos y otro para migraciones.

## Comprobaciones realizadas

- Acceso nuevo por clave como `crmadmin` y sudo comprobados después del cambio de SSH.
- Configuración de SSH validada con `sshd -t`; contraseñas y autenticación interactiva deshabilitadas.
- Compose y Caddy validados; PostgreSQL reporta healthy.
- HTTP 200 en `/healthz` y 503 en `/` comprobados desde una máquina externa.
- PostgreSQL sin bindings de puertos en Docker y conexión externa a 5432 no disponible.
- Primera copia local finalizada con éxito y restaurada en una base temporal separada; base temporal eliminada al finalizar. La base de origen todavía no contiene datos de negocio.
- No se encontraron servicios systemd fallidos antes del reinicio.
- Después de reiniciar, kernel 7.0.0-38, SSH por clave, sudo, UFW, Docker, Caddy, PostgreSQL healthy y temporizador de copias verificados; sin reinicio pendiente ni servicios fallidos. `/healthz` volvió a responder HTTP 200 desde Internet.
- Certificados emitidos para el dominio y su alias `www`; conexión TLS validada desde Windows sin omitir la verificación de certificados, fijando la IP con `curl --resolve` para evitar cachés DNS anteriores.
- HTTPS `/healthz` devuelve 200, `/` devuelve 503; HTTP redirige a HTTPS con 308 y `www` al dominio principal con 301. Compose y Caddy volvieron a validarse después del cambio.

## DNS y HTTPS

Se editó el registro A existente de `@` desde la sesión de Hostinger del titular: ahora apunta al VPS. El TTL anterior de 50 segundos no era aceptado por el formulario; se estableció en 300 segundos. Se conservó el CNAME `www` al dominio principal, sin cambiar nameservers ni otros registros. La tabla DNS de Hostinger y su servidor autoritativo confirmaron el cambio.

Se instaló [Caddyfile.https](../infra/crm-base/Caddyfile.https), con `CRM_DOMAIN` en el `.env` privado y el bloque HTTP anterior conservado como `Caddyfile.http-backup` en el VPS. Caddy obtuvo certificados Let's Encrypt y los administra automáticamente. No se compró SSL. No hay un registro AAAA publicado para el dominio.

Al cierre, el DNS autoritativo y Cloudflare ya resolvían al VPS; Google todavía devolvía el destino anterior. Esto es una diferencia de propagación, no dos registros A publicados. La validación TLS por IP forzada comprueba el servidor y el certificado, pero no afirma que todos los usuarios vean ya el cambio de DNS.

## Antes de habilitar usuarios reales

Desarrollar y desplegar CRM-LAB, crear roles de base apropiados, probar autenticación y permisos, definir almacenamiento de fotos y recuperar una copia completa fuera del VPS. Los objetivos RPO/RTO del diseño todavía no se consideran cumplidos.

Los backups locales no protegen de la pérdida del disco o de la cuenta de hosting. La tarea actual no configura una copia externa, un monitor externo, correo transaccional, servicios de mensajería ni automatización de GitHub.

## Explicación para el grupo de laboratorio

1. Inspeccionamos un servidor nuevo y comprobamos el acceso.
2. Preparamos administración, firewall y contenedores con scripts revisables.
3. Aislamos la base de datos y dejamos un servicio web de preparación.
4. Comprobamos una copia y su restauración sin tocar datos reales.
5. Corregimos el registro A y comprobamos los certificados HTTPS y las redirecciones.
6. La siguiente etapa será implementar el CRM sobre esta infraestructura.

Los scripts se encuentran en [infraestructura](../infra/README.md). No se subieron a GitHub todavía. Una carpeta privada ignorada por Git mantiene los datos de acceso operativos, sin claves privadas ni contraseñas.

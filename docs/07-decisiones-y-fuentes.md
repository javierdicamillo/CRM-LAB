# Decisiones y fuentes de la versión 2

9 de octubre de 2026. El usuario pidió CRM-LAB y PORTAL-LAB separados, ocho inmobiliarias con servidor propio por CRM y presupuesto para ocho VPS nuevos.

| Decisión | Estado | Consecuencia |
| --- | --- | --- |
| Separar CRM y portal | Requisito confirmado | Bases, código de aplicación y despliegue independientes |
| Ocho VPS nuevos CRM | Confirmado | Nueve VPS incluyendo portal |
| Una inmobiliaria por CRM | Diseño derivado del requisito | Retirar tenant compartido del núcleo privado |
| Catálogo público replicado | Recomendación | Búsqueda sin consultar ocho servidores |
| CRM inicia toda la sincronización | Recomendación | Menos exposición de APIs privadas |
| Monorepo y contrato compartido | Recomendación | Compatibilidad revisable con menos coordinación |
| PostgreSQL y disco local | Recomendación | Evitar servicios adicionales en el MVP |
| Chatwoot y canales completos opcionales | Recomendación | Reducir costo de nueve servidores y desarrollo |
| AGPL para aplicaciones | Pendiente de adopción | Definir titularidad antes de publicar código |

La v1 se conserva en [histórico](historico/v1/README.md), marcada como sustituida. No hay software desplegado que migrar; el cambio actual afecta documentación, estructura y contrato. No se modificaron cuentas externas.

## Fuentes primarias

- [Hostinger global](https://www.hostinger.com/vps-hosting) y [Argentina](https://www.hostinger.com/ar/vps-argentina): planes, capacidad y precios consultados.
- [B2](https://www.backblaze.com/cloud-storage/pricing): referencia de almacenamiento externo.
- [Hetzner](https://www.hetzner.com/cloud/): alternativa por cotizar; no se obtuvo precio estable para comparar.
- [Next.js](https://nextjs.org/docs/app/guides/self-hosting) y [Node.js](https://nodejs.org/en/about/previous-releases): autoalojamiento y versiones.
- [PostgreSQL](https://www.postgresql.org/support/versioning/) y [RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html): soporte y aislamiento del portal.
- [OpenAPI](https://www.openapis.org/): contrato independiente del proveedor.
- [Caddy](https://caddyserver.com/docs/automatic-https), [Compose](https://github.com/docker/compose), [Ansible](https://github.com/ansible/ansible), [restic](https://github.com/restic/restic), [Kuma](https://github.com/louislam/uptime-kuma): herramientas de operación.
- [Licencia Next.js](https://github.com/vercel/next.js/blob/canary/license.md), [Better Auth](https://raw.githubusercontent.com/better-auth/better-auth/main/LICENSE.md), [Drizzle](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/main/LICENSE), [PostgreSQL](https://www.postgresql.org/about/licence/) y [AGPL](https://opensource.org/license/agpl-3.0): licencias consultadas.
- [Chatwoot](https://www.chatwoot.com/pricing/self-hosted-plans): límites de edición comunitaria.
- [n8n](https://docs.n8n.io/sustainable-use-license/): condiciones de licencia.
- [Tokko](https://www.tokkobroker.com/es-ar/): referencia funcional.

## Datos pendientes

Nombres y dominios de las ocho inmobiliarias; usuarios y tráfico reales; volumen de fotos y originales; presupuesto de trabajo humano; titular de cada VPS; país y región de hosting; responsables de soporte; licencia definitiva; portales y canales imprescindibles. Se puede avanzar con datos ficticios mientras se resuelven.

Precios y capacidades son observaciones documentales; no se realizó compra, benchmark ni prueba de servidores. Las decisiones técnicas son propuestas y los objetivos de rendimiento y recuperación deben medirse.

## Verificación de la entrega

Se comprobaron enlaces locales y bloques de código de los 25 documentos Markdown existentes en la entrega. El contrato OpenAPI pasó Redocly CLI con reglas minimal, y los ejemplos de publicación, retiro y consulta pasaron validación AJV contra sus esquemas. Esto verifica la documentación técnica y sus muestras; no constituye una prueba de los productos ni de su seguridad.

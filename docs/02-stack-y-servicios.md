# Stack abierto y servicios mínimos

## Herramientas

| Necesidad | Propuesta | Motivo |
| --- | --- | --- |
| Aplicaciones | Next.js, React, TypeScript y Node.js 24 LTS | Un lenguaje principal y despliegue propio |
| Base | PostgreSQL 17 o 18 con parche compatible | Relaciones, transacciones, cola y búsqueda |
| Datos | Drizzle ORM y migraciones SQL | Esquemas inspeccionables |
| Identidad | Better Auth y roles propios | Autenticación local por instalación |
| HTTPS | Caddy | Gestión automática de certificados |
| Despliegue Linux | Docker Engine y Compose | Reproducibilidad sin orquestador complejo |
| Respaldo | restic y exportaciones PostgreSQL | Copias cifradas externas |
| Administración | Ansible | Configurar nueve servidores sin hacerlo a mano |
| Monitoreo | Uptime Kuma opcional y controles de jobs | Alertas simples |
| Compatibilidad | OpenAPI y JSON Schema | Contrato verificable y cliente generado |

Licencias principales: Next.js y Better Auth MIT; Drizzle Apache-2.0; PostgreSQL License; Caddy y Compose Apache-2.0; restic BSD-2-Clause; Ansible GPL-3.0; Kuma MIT. Confirmar versiones, avisos y dependencias transitivas al fijar el build. No se requiere una suscripción comercial de estos núcleos para el despliegue planteado; Docker Desktop es un producto distinto del Engine Linux propuesto.

Fuentes: [Next.js](https://nextjs.org/docs/app/guides/self-hosting), [PostgreSQL](https://www.postgresql.org/support/versioning/), [Caddy](https://github.com/caddyserver/caddy), [Compose](https://github.com/docker/compose), [restic](https://github.com/restic/restic), [Ansible](https://github.com/ansible/ansible), [Kuma](https://github.com/louislam/uptime-kuma), [OpenAPI](https://www.openapis.org/). Las licencias de Next.js, Better Auth y Drizzle están referenciadas en el [registro de fuentes](07-decisiones-y-fuentes.md).

## Servicios a contratar

Ocho VPS CRM y uno portal con Linux mantenido, propuesta Ubuntu 24.04 LTS; dominio del portal; almacenamiento externo de copias; correo según buzones disponibles. Reutilizar dominios existentes para cada CRM o subdominios; no exigir ocho dominios nuevos.

GitHub guarda código y revisiones. Revisar minutos de CI y almacenamiento de imágenes según visibilidad y consumo; no presupuestar capacidad gratuita ilimitada. Ansible se ejecuta desde una estación autorizada, sin máquina permanente adicional.

## Ahorros de diseño

Cada aplicación es un monolito modular. Los procesos de trabajos reutilizan su imagen; no se suma NestJS ni un segundo backend. Cada CRM autentica a su propio equipo; no se instala SSO central.

PostgreSQL conserva trabajos con bloqueo y reintentos. Ocho CRM consultando una vez por minuto generan ocho solicitudes por minuto, además de las de publicaciones. No se justifica Redis inicialmente.

El buscador utiliza índices PostgreSQL. Mapa, PostGIS y búsqueda externa esperan una necesidad medida. Ciudad y barrio se muestran sin API paga de mapas.

Originales privados en cada CRM y fotos públicas en el volumen del portal, con interfaz de almacenamiento intercambiable para pasar a S3 si hace falta. No instalar un servidor S3 en cada VPS. Compilar en CI evita agotar los VPS pequeños. Caddy gestiona HTTPS y entrega de imágenes públicas. [HTTPS automático](https://caddyserver.com/docs/automatic-https).

Reutilizar correo existente y no administrar un servidor SMTP propio. IA opcional, con presupuesto separado; no ejecutar modelos grandes en los VPS del MVP.

## Chatwoot y canales

Chatwoot es opcional por inmobiliaria. Ocho instalaciones agregan memoria, actualización y respaldo. Community no incluye voz integrada ni todas las funciones de permisos comerciales. [Ediciones](https://www.chatwoot.com/pricing/self-hosted-plans).

El circuito inicial usa formulario, notificación por correo y enlace de contacto. Un enlace WhatsApp no sincroniza mensajes. Las conexiones reales de WhatsApp, Instagram, telefonía, TikTok y otros se habilitan como módulos de cada CRM, con sus credenciales y costos; el portal no necesita esos tokens.

n8n no forma parte del núcleo: su licencia Sustainable Use incluye restricciones y no equivale a una licencia abierta sin condiciones de uso comercial. Para esta sincronización bastan Node.js y PostgreSQL. [Licencia](https://docs.n8n.io/sustainable-use-license/).

## Apertura

Proponer AGPL-3.0 para ambos productos; resolver titularidad y adopción antes de publicar código. El contrato y futuro SDK pueden tener licencia permisiva definida explícitamente. Hostinger y GitHub son servicios comerciales sustituibles; no se los describe como abiertos.

Exportar SQL, JSON, CSV y originales. La instalación debe restaurarse en otro proveedor con documentación y copias, sin necesitar la base privada de otra inmobiliaria.

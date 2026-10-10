> HISTÓRICO — Diseño v1 sustituido el 9 de octubre de 2026. Consultar el README de la raíz para la arquitectura vigente de ocho CRM independientes y un portal.

# Factibilidad y elección del stack

## Dictamen

La integración es técnicamente viable. Un inventario único puede alimentar el CRM y las publicaciones, y cada consulta pública puede convertirse en un registro comercial dentro de la inmobiliaria correspondiente. La dificultad principal está en proteger los datos entre organizaciones, mantener información consistente y sostener la operación.

La viabilidad comercial todavía requiere validar adopción, presupuesto de mantenimiento y canales de captación. Un portal técnicamente correcto no obtiene tráfico por sí solo. El piloto debe comprobar que el equipo inmobiliario realmente utiliza el circuito completo.

| Dimensión | Evaluación | Condición |
| --- | --- | --- |
| CRM y portal integrado | Favorable | Una fuente de datos y reglas comunes de publicación |
| Multicliente | Viable con cuidado | Aislamiento probado en datos, archivos, consultas y permisos |
| Código abierto | Favorable | Licencia explícita y dependencias compatibles |
| Node.js en Hostinger | Admitido en planes específicos | Revisar el plan concreto y probar el despliegue |
| Multipublicación externa | Condicionada | Acceso, contratos y pruebas por cada proveedor |
| Equivalencia completa con Tokko | Fuera del MVP | Requiere un programa sostenido de producto e integraciones |

## Supuestos del piloto

Mercado inicial en español y operación orientada a Argentina, a confirmar. De 3 a 10 inmobiliarias, 10–50 usuarios internos y hasta 5.000 propiedades totales. Portal compartido con páginas por inmobiliaria; sin dominios personalizados al comienzo. Ventas y alquileres, precios con moneda explícita y consultas sin registro del visitante.

No se incluye administración contable de alquileres, liquidación de comisiones, firma de contratos, cobros de suscripciones ni aplicaciones móviles nativas. Se plantea una web adaptable a dispositivos móviles.

## Construir o adaptar una solución existente

Esta comparación es de encaje arquitectónico; no es un benchmark de rendimiento ni una auditoría exhaustiva de los productos.

| Alternativa | Ventaja | Trabajo adicional y limitación | Decisión |
| --- | --- | --- | --- |
| Aplicación propia sobre bibliotecas abiertas | Un único modelo inmobiliario, permisos y experiencia de uso | Hay que construir el CRM y mantenerlo | Recomendada para el objetivo de producto y aprendizaje |
| Twenty más un portal propio | Base CRM y ecosistema JavaScript/TypeScript | Integrar inventario, publicación, identidades y operación; validar aislamiento y funciones por edición | Evaluar con un prototipo si pesa más acelerar CRM que unificar el producto |
| Frappe CRM más módulos inmobiliarios | CRM existente y framework extensible | Backend Python/Frappe y frontend Vue; requiere una infraestructura distinta de una app Node.js sola | Alternativa si se acepta cambiar stack y usar VPS |
| Portal conectado a Tokko | Aprovecha el CRM de una inmobiliaria ya usuaria | Dependencia de una cuenta, credenciales y capacidades de su API | Útil como integración opcional; no satisface un CRM propio abierto |

Twenty declara un esquema mixto: gran parte AGPLv3, paquetes MIT y archivos Enterprise comerciales. No debe asumirse que todo el repositorio tiene la misma licencia. Frappe CRM declara AGPL-3.0 y documenta Frappe y Vue como base. Fuentes: [Twenty](https://github.com/twentyhq/twenty), [licencia de Twenty](https://github.com/twentyhq/twenty/blob/main/LICENSE) y [Frappe CRM](https://github.com/frappe/crm).

La recomendación de desarrollo propio supone al menos una persona capaz de revisar arquitectura, seguridad y despliegue. Si el laboratorio no cuenta con ella, conviene mantener el trabajo como demostración con datos ficticios y revisar una base CRM existente antes de atender clientes reales.

## Stack recomendado

| Capa | Selección propuesta | Motivo |
| --- | --- | --- |
| Lenguaje y ejecución | TypeScript y Node.js 24 LTS | Un lenguaje principal para interfaz y servidor |
| Aplicación | Next.js estable, con App Router | Páginas públicas renderizadas en servidor y área privada en el mismo proyecto |
| Interfaz | React, CSS y componentes accesibles | Formularios, tablas y navegación adaptables al celular |
| Base | PostgreSQL en versión soportada por el proveedor | Relaciones, transacciones y políticas por fila |
| Acceso a datos | Drizzle ORM y migraciones SQL revisadas | Esquema tipado con control de políticas y consultas |
| Identidad | Better Auth con organizaciones | Sesiones, membresías e invitaciones; permisos de negocio propios |
| Fotografías y adjuntos | Almacenamiento de objetos compatible con S3 | Separar archivos del ciclo de despliegue |
| Búsqueda inicial | Índices y consultas PostgreSQL | Evitar un motor adicional antes de medir la necesidad |
| Tareas diferidas | Bandeja persistente en PostgreSQL y ejecutor programado | Reintentos de correo y sincronización, sin depender de memoria del proceso |
| Validación | Pruebas unitarias, integración con PostgreSQL y recorridos de navegador | Verificar permisos y el circuito de venta |

Next.js admite autoalojamiento. Node.js recomienda LTS para producción; la rama 24 figura como LTS en la fecha de consulta. Se debe fijar el parche validado en el archivo de bloqueo y mantener actualizaciones de seguridad. Fuentes: [Next.js](https://nextjs.org/docs/app/guides/self-hosting) y [Node.js](https://nodejs.org/en/about/previous-releases).

Drizzle documenta soporte para políticas RLS de PostgreSQL y Better Auth ofrece organizaciones. Ninguna biblioteca sustituye las verificaciones de autorización del negocio. Fuentes: [Drizzle RLS](https://orm.drizzle.team/docs/rls) y [organizaciones de Better Auth](https://better-auth.com/docs/plugins/organization).

Se recomienda un monolito modular: una aplicación con módulos internos delimitados. No incorporar al inicio microservicios, Kubernetes, un buscador externo ni un segundo backend NestJS. Un proceso separado para trabajos, cuando sea necesario, puede reutilizar el mismo código y repositorio.

## Opciones de Hostinger

| Opción | Encaje | Condición de uso |
| --- | --- | --- |
| Business o Cloud con Node.js y PostgreSQL externo | Primera opción para un piloto con poca administración de servidores | Probar TLS saliente, límites de conexiones, latencia, secretos y tareas programadas |
| VPS Hostinger con Node.js y PostgreSQL | Preferible si todo debe residir en Hostinger o habrá trabajos persistentes | Designar responsable de Linux, actualizaciones, monitoreo y recuperación |
| Node.js y MySQL del hosting | Alternativa si manda el costo o se impide usar base externa | Rediseñar la capa de datos; no conserva las políticas RLS de PostgreSQL |

El soporte de Node.js no significa que el plan permita instalar PostgreSQL, Redis o cualquier servicio persistente. La documentación de Hostinger reserva esas bases para VPS; admite aplicaciones Node.js en Business y Cloud y despliegue desde GitHub. Fuentes: [opciones](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/), [guía de despliegue](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) y [bases admitidas](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/).

No se verificó una cuenta concreta. Persistencia de disco, memoria de compilación, tiempos de ejecución, dominios, programación de trabajos y recuperación deben comprobarse en el plan contratado. No se presupone soporte para Docker Compose en Node.js administrado; el diseño con contenedores corresponde al VPS.

## Código abierto y costos

Para el código propio se propone AGPL-3.0: adecuada si se quiere mantener disponible el código de las modificaciones ofrecidas por red conforme a sus condiciones. MIT es una alternativa si se prioriza reutilización permisiva, incluso en productos cerrados. La elección y el titular de derechos deben quedar asentados antes de publicar el código. Esta evaluación no aplica todavía una licencia al proyecto. [Texto AGPL aprobado por OSI](https://opensource.org/license/agpl-3.0).

Licencias consultadas de componentes principales: [Next.js MIT](https://github.com/vercel/next.js/blob/canary/license.md), [Better Auth MIT](https://raw.githubusercontent.com/better-auth/better-auth/main/LICENSE.md), [Drizzle Apache-2.0](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/main/LICENSE) y [PostgreSQL License](https://www.postgresql.org/about/licence/). Al fijar versiones, registrar también las dependencias transitivas, los avisos y los recursos gráficos utilizados.

GitHub, Hostinger y los servicios contratados no pasan a ser abiertos por alojar software abierto. El objetivo es que el núcleo pueda instalarse y modificarse, y que los proveedores de archivos, correo y base de datos puedan sustituirse mediante configuración y exportaciones.

El costo principal será desarrollo y mantenimiento. Ejemplo aritmético para reservar presupuesto, **no precios cotizados**: alojamiento 20 USD/mes + base 25 + archivos y copias 10 + correo y monitoreo 10 = 65 USD/mes. Sumando 20 USD opcionales de IA: 85 USD/mes. Reemplazar cada supuesto por una oferta real con impuestos, renovación, transferencia y soporte; evitar contar dos veces una base ya incluida en un VPS.

Para el trabajo humano usar: horas estimadas × costo horario acordado + reserva de contingencia. La gratuidad de una licencia no elimina guardias, respaldos, correcciones ni atención a usuarios.

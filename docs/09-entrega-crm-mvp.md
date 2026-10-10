# CRM-LAB 0.1.0 — entrega del piloto

9 de octubre de 2026 · Inmobiliaria: **inmolab** · Sitio: **https://open-crm.tech**.

## Qué quedó funcionando

Aplicación web con datos persistentes en el VPS existente. No se contrataron servicios adicionales. El sitio usa HTTPS y la base PostgreSQL no se expone a Internet. La primera cuenta se activa con un enlace privado y un correo reservado; no hay registro público. El titular elige su contraseña. El servidor comienza sin clientes, propiedades ni cuentas de prueba.

| Área | Disponible |
| --- | --- |
| Inicio | Indicadores de inventario, oportunidades y actividades pendientes |
| Propiedades | Alta y edición, ubicación pública y dirección privada, propietario, estado y características |
| Ofertas | Venta/alquiler, precio, moneda, período y publicación independiente |
| Fotografías | Original privado, derivada WebP sin EXIF, galería y aprobación para publicación |
| Contactos | Comprador, propietario, inquilino u otro; datos y responsable |
| Oportunidades | Nuevo, contactado, visita, negociación, ganado y perdido |
| Agenda | Actividades, vencimiento, responsable y estado de cumplimiento |
| Equipo | Administradores y agentes, desactivación y restablecimiento de acceso |
| Datos | Exportación JSON/CSV y ZIP con fotografías; auditoría de acciones |
| Integración | Cola persistente, fichas públicas, revisiones, reintentos, deduplicación y pausa tras restauración inconsistente |

Los agentes activos trabajan sobre el catálogo y los contactos compartidos de su inmobiliaria. El administrador controla usuarios, configuración y exportaciones completas. No se implementan permisos de sucursal ni aislamiento entre agentes. El aislamiento entre inmobiliarias se logra con instalaciones, bases y servidores separados.

## Primera entrada y recorrido de demostración

1. Abrir el formulario de activación privado entregado al titular. Completar nombre, correo reservado y contraseña de al menos 12 caracteres. El enlace solo funciona antes de crear el primer administrador.
2. Crear un contacto propietario y una propiedad. Separar la ubicación que se publicará de la dirección y notas privadas.
3. Agregar una oferta de venta o alquiler. Subir y aprobar al menos una fotografía antes de publicar.
4. Crear un comprador, una oportunidad y una actividad con fecha. Cambiar de etapa y completar la actividad.
5. Invitar operativamente al equipo creando sus cuentas desde Configuración; entregar las claves temporales por un canal privado. No hay correo de invitación automático.
6. Exportar datos desde Configuración. Para una exposición, usar únicamente datos ficticios en un entorno de prueba.

**Publicar deja el envío en cola mientras PORTAL-LAB no esté conectado.** No significa que la ficha ya aparezca en un portal público. La pantalla distingue borrador, cola, sincronizada, retiro pendiente y revisión requerida.

Las consultas de un portal se identifican por portal e ID de consulta. Si se reciben otra vez, no crean un segundo seguimiento. Cuando existe exactamente un contacto con ese correo, se reutiliza; no se fusiona por nombre. Una oportunidad abierta del mismo contacto y oferta también se reutiliza. La importación JSON administrativa es una herramienta de recuperación/prueba, no un conector a WhatsApp.

## Evidencias de verificación

| Control | Resultado observado |
| --- | --- |
| TypeScript y build | Correctos; build de producción ejecutado en Linux |
| Pruebas unitarias | 4 aprobadas: validación, DTO público/OpenAPI, tokens y reintentos |
| Pruebas HTTP | 41 comprobaciones aprobadas en base separada `crm_lab_test` |
| Permisos | Sin sesión: 401; agente sin acceso a administración/exportación; sesión revocada al desactivar |
| Integridad | Conflicto de edición: 409; publicación sin foto aprobada rechazada; consulta repetida sin duplicados |
| Fotos y exportación | Subida, aprobación, acceso privado y exportación ZIP verificados |
| Worker con simulador | Reintento tras 429, subida de foto, confirmación de publicación, ACK de consulta repetida y pausa ante revisión remota superior |
| Navegador | Acceso de prueba y creación de propiedad con confirmación visible |
| Dependencias | `npm audit --omit=dev`: cero vulnerabilidades conocidas en el momento de la revisión |
| Sitio real | HTTPS válido, página 200, `/healthz` 200 con consulta a PostgreSQL, `/api/state` sin sesión 401 |
| Recuperación | Snapshot restic comprobado y restaurado a una base temporal; configuración y secretos presentes |

La restauración corresponde a la instalación de producción aún vacía, con cero fotos y registros. La prueba ZIP usa una foto sintética. No se afirma una restauración con datos reales ni el cumplimiento medido de RPO/RTO. Tampoco se ejecutaron pruebas de carga, auditoría independiente, compatibilidad entre dos versiones ni aislamiento con dos CRM y el portal real.

## Cómo se instaló

La aplicación usa Next.js, React y TypeScript; Better Auth gestiona sesiones y contraseñas; PostgreSQL persiste los datos; Drizzle/pg acceden a la base; Zod valida entradas y Sharp procesa imágenes. Caddy termina HTTPS. Docker Compose ejecuta aplicación, worker, PostgreSQL y Caddy.

La aplicación utiliza `crm_app`, un rol PostgreSQL sin superusuario ni privilegios de creación de tablas. Las migraciones se ejecutan aparte con credenciales administrativas. Los archivos secretos se generan en el servidor y no se almacenan en Git. El contenedor de aplicación no ejecuta como root.

Código: `CRM-LAB/`. Despliegue: `infra/crm-base/compose.app.yaml`. Dominio: `Caddyfile.app`. Preparación: `infra/scripts/prepare-app.sh`. Migración/provisión: `CRM-LAB/scripts/provision.mjs`. La imagen `crm-lab:0.1.0` se construyó localmente en el VPS; no se pagó un registry ni un servicio de build. El piloto de 1 vCPU/4 GB necesita medición antes de aumentar carga.

Para aplicar una nueva versión: revisar el diff; hacer y verificar una copia; construir con tag nuevo; migrar con el script revisado; actualizar la referencia de app y worker; validar Compose y ejecutar `docker compose -f compose.yaml -f compose.app.yaml up -d --wait`. Probar HTTPS, inicio de sesión y un recorrido comercial. Conservar imagen y esquema compatibles para volver atrás. No restaurar una base antigua como sustituto de un rollback sin evaluar la pérdida de cambios.

## Copias y recuperación

El temporizador `crm-lab-backup.timer` ejecuta una copia cada seis horas, con variación de hasta dos minutos. `backup-app.sh` produce un dump PostgreSQL consistente y respalda dump, fotos, secretos, Compose y Caddy en un repositorio restic cifrado local. La contraseña está en `/opt/crm-lab/secrets/restic_password`. Las fotos no se eliminan físicamente en esta versión, evitando perder un archivo referenciado por el dump.

La retención conserva todo durante siete días, catorce copias diarias y tres mensuales. `forget` elimina referencias antiguas; hace falta mantenimiento periódico `restic prune` para recuperar el espacio no referenciado. Vigilar disco y resultados del servicio: no hay alertas externas configuradas.

Se descargó una **copia inicial puntual** del repositorio cifrado al equipo del titular y se verificó su SHA-256. Se encuentra en `infra/private/respaldo-inicial-restic.tar.gz`, con clave independiente `clave-restic.txt`, dentro de una carpeta con acceso restringido al titular, SYSTEM y administradores del equipo. Estos archivos están ignorados por Git. Esta descarga no establece copias externas automáticas y no contiene cambios futuros. Guardar la clave también en un lugar privado independiente.

`infra/scripts/verify-app-backup.sh` verifica el repositorio y restaura a una base temporal nueva, comprueba archivos y elimina únicamente sus temporales. Para recuperación completa en otro servidor:

1. Preparar PostgreSQL y Docker compatibles; conservar el servidor y los datos originales para diagnóstico.
2. Recuperar el repositorio restic y su clave; ejecutar `restic check` y restaurar el snapshot elegido a un directorio de preparación privado.
3. Restaurar los roles y contraseñas necesarios; crear una base vacía y recuperar `current.dump`. Reponer fotos, secretos y configuración con propietarios/permisos correctos. La copia SQL de una base no incluye los roles globales de PostgreSQL.
4. Reconstruir la imagen desde el código correspondiente; no activar el worker hasta verificar el catálogo remoto y la antigüedad de la copia.
5. Comprobar autenticación, registros, fotos y dominios. Reconciliar el portal y reanudar explícitamente solo cuando no existan revisiones remotas más recientes sin recuperar.

Antes de incorporar información comercial real de forma habitual, terminar el respaldo externo periódico y probar su restauración. Si el destino implica costos, solicitar autorización del titular antes de contratarlo.

## Alcance pendiente

- PORTAL-LAB real y pruebas de extremo a extremo con dos inmobiliarias.
- Sincronización validada entre versiones, auditoría integral de medios y recuperación con un historial comercial real.
- WhatsApp, Instagram, correo, telefonía, TikTok, Telegram y portales comerciales: no conectados ni contratados.
- Respaldo externo automático y alertas de fallos.
- Repositorio publicado en [javierdicamillo/CRM-LAB](https://github.com/javierdicamillo/CRM-LAB). El estado de CI se consulta en Actions; no hay despliegue automático ni secretos del VPS en GitHub. Falta designar colaboradores y acordar revisiones.
- Paginación antes de superar 20.000 registros por instalación, pruebas de carga, permisos de sucursales y recuperación de contraseña por correo.

## Exposición breve para el laboratorio — cinco minutos

1. **Problema (40 s):** ocho inmobiliarias necesitan autonomía; un CRM por servidor y un portal común evitan compartir bases privadas.
2. **Solución (50 s):** mostrar propiedades, contactos, oportunidad y agenda. El piloto ya es una aplicación persistente con acceso privado.
3. **Contrato (50 s):** aprobar una ficha pública; explicar que el portal solo recibe campos autorizados y que una caída deja trabajos en cola.
4. **Pruebas (60 s):** mostrar evidencia de acceso denegado, edición concurrente, consulta repetida y recuperación en una base temporal. Distinguir simulador de portal real.
5. **IA y revisión (40 s):** Codex colaboró en implementación, scripts y pruebas; explicar qué comprobaciones se ejecutaron y qué requiere validación humana del negocio.
6. **Siguiente etapa (60 s):** activar el piloto, evaluar el flujo con usuarios, conectar el portal, completar copias externas y ampliar gradualmente. No presentar las ocho agencias como ya desplegadas.

No mostrar enlaces de activación, contraseñas, archivos `.env`, clientes reales ni claves SSH durante la exposición.

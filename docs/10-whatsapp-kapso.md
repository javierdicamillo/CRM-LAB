# WhatsApp con Kapso — estado, decisiones y traspaso

13 de noviembre de 2026 · Branch `whatsapp` · Commit `eae419f` · **Sin desplegar**

Documento de traspaso: resume qué se hizo, por qué, qué se verificó y qué falta.
Sirve para retomar el trabajo en otra sesión sin reconstruir el contexto.

---

## 1. Objetivo

Completar el flujo mínimo de WhatsApp con **Kapso** como transporte:
un cliente escribe, el CRM responde automáticamente por reglas, y las acciones
(pedir agente, coordinar visita) quedan registradas. Se trabaja en el WIP que ya
existía en `CRM-LAB` y `PORTAL-LAB`.

## 2. Decisiones tomadas

| Tema | Decisión |
| --- | --- |
| Rol de Kapso | Solo transporte. La conversación y las reglas viven en el CRM (`KatyResponder`). |
| Número oficial | Producción `1404393919431625` (`+1 555-781-8580`), unificado entre CRM y botón `wa.me` del portal. |
| Contactos desconocidos | Se dan de alta como contacto automáticamente y se les responde. |
| Consistencia | Inbound + respuesta + acciones en **una sola transacción** (patrón outbox). |
| Contexto | Se guarda `whatsappPropertyId` en el contacto para priorizar la propiedad consultada. |
| Reintentos | Tope de 8 intentos; 400/401/404/413 y 403 de auth son permanentes; 403 de sandbox y 422 de ventana de 24 h se reintentan con backoff. |
| Saludo proactivo | Se mantiene, pero acotado por el tope de reintentos. |
| Workflow Kapso `Respuesta basica` | Se mantiene activo: su trigger es solo sandbox y no interfiere con producción. |
| Next.js | No se actualiza 16.4.0 por ahora (decisión explícita del titular). |

## 3. Arquitectura del flujo

```
Cliente escribe  →  Kapso  →  POST /webhooks/kapso  →  CRM (transacción)
   al número oficial                                        │
   (botón wa.me del portal)                                 ▼
                            crea/busca contacto · carga propiedad · arma respuesta
                                                            │
                       envío por Kapso  ←  worker (cola whatsapp_messages)
                                                            ▼
                                     llega al WhatsApp del cliente en ~3-10 s
```

Puntos clave:

- Kapso firma el body crudo con `X-Webhook-Signature = HMAC-SHA256(secreto, body)`.
- La deduplicación es por `message.id`: reenviar el mismo evento no genera doble respuesta.
- La respuesta se encola en `whatsapp_messages`; el **worker** es quien envía.
- El bot responde **solo** a mensajes entrantes (`kapso.direction === 'inbound'`).

## 4. Archivos

### CRM-LAB

| Archivo | Qué aporta |
| --- | --- |
| `migrations/002-whatsapp.sql` | Tabla `whatsapp_messages`: cola de salida + log de entrada, con `dedupe_key` único e índices. |
| `src/app/webhooks/kapso/route.ts` | Endpoint `POST /webhooks/kapso`: firma HMAC, batches, dedupe, y transacción inbound + respuesta + acciones. |
| `src/lib/whatsapp.ts` | Normalización, `findOrCreateContact`, `loadLead` con contexto de propiedad, `applyLeadActions`, cola con reintentos, `verifyWebhookSignature`. |
| `src/lib/katy.ts` | `KatyResponder`: respuestas por reglas y estado conversacional (`whatsappPending`). |
| `src/lib/origins.ts` | Orígenes confiables (acepta `localhost` y `127.0.0.1` en local). |
| `src/lib/business.ts` | `importInquiry` normaliza el teléfono, guarda `whatsappPropertyId` y encola el saludo. |
| `src/lib/kapso.ts` | Envío de texto; `KAPSO_PHONE_NUMBER_ID` tiene prioridad sobre el sandbox. |
| `src/lib/db.ts` | `audit` acepta cualquier cliente con `query` (para usarlo dentro de transacción). |
| `src/app/api/whatsapp/send/route.ts` | Envío manual desde el CRM y traducción de errores de Kapso. |
| `src/app/catalog/route.ts` | `GET /catalog`: lectura pública del catálogo para el agente de Kapso; exige token Bearer y `limited()`. |
| `src/lib/catalog.ts` | Filtros y consulta del catálogo: solo ofertas publicadas, inmueble disponible/reservado y al menos una foto aprobada; proyecta con `publicListing`. |
| `scripts/worker.ts` | Loop: sincronización cada 60 s + cola de WhatsApp cada ~3 s. |
| `scripts/migrate.ts` | Aplica `001-initial` y `002-whatsapp`. |
| `tests/whatsapp.test.ts` | 6 tests: teléfonos, Katy (datos/visita/agente/fallback) y firma HMAC. |
| `tests/catalog.test.ts` | Filtros, valores por defecto, rechazos y escape de comodines ILIKE del catálogo. |
| `RESUMEN-WHATSAPP-KAPSO.txt` | Doc operativa (se conserva en `.txt`). |
| `.env.example` | Suma `KAPSO_WEBHOOK_SECRET` y `CATALOG_TOKEN`. |
| `package.json` | `worker:dev` y `migrate` cargan `.env.local`. |

### PORTAL-LAB

| Archivo | Qué aporta |
| --- | --- |
| `src/components/inquiry-form.tsx` | Tras enviar la consulta, muestra el CTA `wa.me` con el número de producción. |
| `src/lib/phone.ts` | Normalización de teléfono (misma que el CRM). |
| `src/lib/catalog.ts` | Valida y normaliza el teléfono antes de guardarlo. |
| `src/app/propiedades/[id]/page.tsx` | Pasa `propertyTitle` al formulario. |
| `.env.example` | Reemplaza `NEXT_PUBLIC_WHATSAPP_SANDBOX_NUMBER` por `NEXT_PUBLIC_WHATSAPP_NUMBER`. |

## 5. Comportamiento del bot

- **Precio / ubicación / requisitos / descripción**: responde con los datos de la propiedad consultada.
- **Visita**: pide día y horario en dos pasos y crea una actividad tipo `visit`.
- **Agente**: agrega nota al contacto y registra auditoría (`whatsapp.agent_requested`).
- **No entiende**: ofrece derivar a un agente (`whatsappPending = offer_agent`).
- **Contacto desconocido**: se crea (`whatsapp.contact_created`) y se responde.
- **Consulta del portal**: `importInquiry` guarda `whatsappPropertyId` y encola el saludo (`whatsapp.activation_queued`).

Auditoría: `whatsapp.contact_created`, `whatsapp.agent_requested`, `whatsapp.visit_requested`, `whatsapp.activation_queued`, `whatsapp.sent`.

## 6. Entorno local

Base PostgreSQL de desarrollo (contenedor `crm-db`, `postgres:18-alpine`,
`crm_user/crm_password@localhost:5432/crm_local`).

```
docker start crm-db
npm run migrate          # aplica 001-initial y 002-whatsapp
npm run dev              # app en http://127.0.0.1:3000
npm run worker:dev       # procesa la cola (en otra terminal)
```

Variables en `CRM-LAB/.env.local` (no versionado):

- `DATABASE_URL`
- `KAPSO_API_KEY`
- `KAPSO_PHONE_NUMBER_ID=1404393919431625`
- `KAPSO_WEBHOOK_SECRET` — **provisorio**; debe reemplazarse por el `secret_key` real que devuelva Kapso al crear el webhook.
- `TEST_PHONE_NUMBER="541167062068"`, `META_PHONE_NUMBER="15557818580"`
- `CATALOG_TOKEN` — token Bearer de `GET /catalog` para el agente de Kapso.
- `AGENT_TOKEN` — token Bearer de `POST /agent/leads`, la escritura del agente (contacto, resumen y visita). No reutilizar el token de lectura.
- `PORTAL_URL`, `PORTAL_TOKEN`, `PORTAL_INSTANCE_ID` — **vacías** (sincronización portal→CRM sin configurar).

`PORTAL-LAB/.env.local` **no existe** todavía.

## 7. Verificación (evidencia)

| Control | Resultado |
| --- | --- |
| CRM-LAB `typecheck` | OK |
| CRM-LAB `test` | 11/11 OK |
| CRM-LAB `build` | OK (`dist/worker.mjs`); el primer intento se detiene por el aviso de seguridad de Next y el segundo compila |
| PORTAL-LAB `typecheck` | OK |
| PORTAL-LAB `test` | 12/12 OK |
| PORTAL-LAB `build` | OK |
| `worker:dev --once` | exit 0 |
| Webhook con firma inválida | HTTP 401 `{"error":"Firma inválida."}` |
| Webhook válido | HTTP 200 `{"ok":true,"processed":1,...}` |
| Reenvío del mismo `message.id` | HTTP 200 `duplicates:1`, sin doble respuesta |
| Respuesta de precio | `state: sent`, "El precio es US$ 100.000,00." |
| Número desconocido | contacto creado; el envío falla con `Cannot send non-template messages outside the 24-hour window.` (esperado) |

La prueba local se hizo firmando el body con `KAPSO_WEBHOOK_SECRET` y enviando
`POST /webhooks/kapso` con payload v2.

> Nota: durante esa prueba se enviaron mensajes reales al teléfono `541167062068`
> (Guillermo). Los dos mensajes que aparecen en su WhatsApp (02:00 y 02:01 del
> 13/11) **no** son respuesta a su "Como estas STM" (01:33): son la respuesta a
> las dos simulaciones ("¿Cuánto sale?" y "precio"). Su mensaje real nunca entró
> al CRM porque el webhook no está registrado. Evidencia: los `dedupe_key`
> `reply:wamid.local.test.*` y 0 coincidencias al buscar "STM" en la base.

## 8. Estado del repositorio

- Branch `whatsapp`, commit `eae419f` ("feat: conectar WhatsApp de Kapso con el CRM y el portal"), 25 archivos.
- **Ahead 1, sin pushear.** Pushear dispara CI (`crm.yml`: typecheck, test, build, `npm audit`).
- `CRM-LAB/Katy.txt` queda **sin rastrear a propósito**: es un volcado accidental del resumen de la conversación, no trabajo del proyecto.
- `PORTAL-LAB/package-lock.json` se revirtió (ruido de `libc` de npm en Windows).
- Los `next-env.d.ts` se restauraron.

## 9. Pendiente para producción

Producción actual: `https://open-crm.tech` (VPS, Caddy + HTTPS, app + worker
`crm-lab:0.1.0`). Verificado el 13/11: `/healthz` 200; `POST /webhooks/kapso`
**404** (la ruta no está desplegada).

Huecos y orden sugerido:

1. **Migración**: corregido en el working tree. `CRM-LAB/scripts/provision.mjs` descubre `migrations/*.sql`, las aplica en orden y recién después ejecuta los `GRANT`. Verificado en una base temporal: se aplicaron `001-initial` y `002-whatsapp`, y `crm_app` quedó con permisos sobre `whatsapp_messages`. Falta commitear y desplegar.
2. **Secretos**: agregar `KAPSO_API_KEY`, `KAPSO_PHONE_NUMBER_ID`, `KAPSO_WEBHOOK_SECRET` y `CATALOG_TOKEN` a `/opt/crm-lab/secrets/app.env`. Hoy no hay ninguna `KAPSO_*`, así que el webhook respondería 503 por diseño, y sin `CATALOG_TOKEN` el catálogo responde 503.
3. **Imagen**: construir con tag nuevo y actualizar **app y worker juntos** (el README lo exige).
4. **Compose**: validar y `docker compose -f compose.yaml -f compose.app.yaml up -d --wait`.
5. **Webhook**: registrar apuntando a `https://open-crm.tech/webhooks/kapso` y guardar el `secret_key` real.

Comandos de referencia (desde el VPS, como `crmadmin`):

```bash
# 0) Copia y verificación previas
# 1) Construir imagen nueva desde la raíz del repositorio
docker build -f CRM-LAB/Dockerfile -t crm-lab:0.2.0 .
# 2) Aplicar migración con el script revisado (rol administrador)
docker run --rm --network crm-lab_database --user 0 \
  -e TARGET_DATABASE=crm_lab -e AGENCY_NAME=inmolab \
  -e ADMIN_PASSWORD_FILE=/secrets/postgres_password \
  -e APP_PASSWORD_FILE=/secrets/app_password \
  -v /opt/crm-lab/secrets:/secrets:ro crm-lab:0.2.0 node scripts/provision.mjs
# 3) Actualizar referencia de app y worker en compose.app.yaml (crm-lab:0.2.0)
# 4) Validar y levantar
docker compose config --quiet
docker compose -f compose.yaml -f compose.app.yaml up -d --wait
# 5) Registrar webhook (desde la máquina con las skills de Kapso)
node .agents/skills/integrate-whatsapp/scripts/create.js \
  --url https://open-crm.tech/webhooks/kapso \
  --phone-number-id 1404393919431625 \
  --scope config \
  --events whatsapp.message.received \
  --payload-version v2 \
  --buffer-enabled true \
  --buffer-window-seconds 3
# 6) Guardar el secret_key devuelto en app.env y recrear la app
node .agents/skills/integrate-whatsapp/scripts/list.js \
  --phone-number-id 1404393919431625 --scope config
```

### Prueba local con sandbox (sin tocar el VPS)

Para verificar la ruta y la firma sin desplegar, se puede exponer el servidor
local con un túnel HTTPS y registrar el webhook en el número sandbox
`597907523413541`:

```bash
npx cloudflared tunnel --url http://127.0.0.1:3000
# alta del webhook apuntando a https://<tunel>/webhooks/kapso
```

- El sandbox de Kapso no expone un número público (`display_phone_number: null`):
  sirve para probar configuración, firma y eventos de prueba, no para recibir un
  WhatsApp real de un cliente.
- La API actual exige `secret_key` al crear el webhook. Si el script de la skill
  no lo envía, se genera uno aleatorio y se guarda solo en `.env.local`
  (local) o en `secrets/app.env` (producción).
- El número de producción sigue apuntando a `https://open-crm.tech/webhooks/kapso`
  y esa ruta continúa en 404 hasta desplegar la imagen nueva.

## 10. Riesgos y advertencias

- **Doble respondedor**: el workflow `Respuesta basica` de Kapso está activo con trigger `inbound_message` sobre el número de producción `1404393919431625` y responde solo (`auto_send_assistant_text`). Si el CRM también encola la respuesta de Katy, el cliente recibe dos mensajes. Decisión: **responde el workflow**; el CRM registra, sincroniza y aplica acciones con `WHATSAPP_AUTOREPLY=off`. Sin ese flag, el webhook encola la respuesta de Katy.
- **Agente sin herramienta registrada**: el prompt del workflow pide "usar la herramienta de búsqueda" y el CRM ya expone `GET /catalog`, pero el agente sigue sin `flow_agent_function_tools`. Faltan registrar dos funciones: `search_catalog` (`GET https://open-crm.tech/catalog`, `Authorization: Bearer $CATALOG_TOKEN`) y `save_lead` (`POST https://open-crm.tech/agent/leads`, `Authorization: Bearer $AGENT_TOKEN`). El prompt y el contrato de ambas están en `CRM-LAB/agent/kapso-agent-prompt.md`. Hasta entonces debe responder que no tiene el dato.
- **Envío desde producción bloqueado**: el número devuelve `#131037 WhatsApp provided number needs display name approval before message can be sent`. Hasta aprobar el display name, el CRM no puede enviar desde ese número.
- **Número de prueba de Meta**: `+1 555-781-8580` solo permite escribir a números autorizados. Para clientes reales hace falta un número verificado.
- **Ventana de 24 h**: sin plantillas aprobadas no se puede iniciar una conversación. Por eso el CTA `wa.me` del portal (el cliente inicia) es la pieza clave.
- **Saludo proactivo**: si el cliente aún no escribió, cae en la ventana de 24 h (422) y se agota por el tope de intentos.
- **Buffer de Kapso**: sin `buffer_enabled`, tres mensajes seguidos generan tres respuestas. Se recomienda 1–5 s.
- **Next.js 16.4.0**: vulnerabilidad conocida. El `build` se detiene la primera vez con `SecurityFatalError` y sigue en el segundo intento. `npm audit` puede marcarlo. Actualización **postergada** por decisión del titular (`next upgrade --agent=security`).
- **Costo**: Meta cobra por conversación.
- **Naming**: el bot se presenta como "Soy Cerreme" pero el módulo/clase es `Katy`. Unificar si se desea.

## 11. Cómo retomar

1. `git log --oneline -3` → confirmar `eae419f` en `whatsapp`.
2. `docker start crm-db` y `npm run migrate` en `CRM-LAB`.
3. `npm run dev` + `npm run worker:dev`.
4. Para el flujo real: desplegar a producción (sección 9) y registrar el webhook; después escribir desde un teléfono autorizado al número oficial.
5. Para probar sin Kapso: firmar el payload con `KAPSO_WEBHOOK_SECRET` y hacer `POST /webhooks/kapso` (ver `RESUMEN-WHATSAPP-KAPSO.txt`, sección 5).

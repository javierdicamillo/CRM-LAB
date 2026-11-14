# Runbook — desplegar el agente de Kapso en producción

Documento para el agente que administra el VPS. Objetivo: llevar a producción la rama
`whatsapp` de CRM-LAB, que agrega el webhook de Kapso, el catálogo público y la escritura
del agente, y dejarla verificada. Nada de lo escrito acá debe ejecutarse sin leer la sección
de rollback y la de prohibiciones.

## 1. Estado de partida (verificado el 14/11/2026)

| Hecho | Evidencia |
| --- | --- |
| Producción corre `crm-lab:0.1.0` | `infra/crm-base/compose.app.yaml` |
| `GET https://open-crm.tech/healthz` responde 200 | comprobado por HTTP |
| `GET https://open-crm.tech/catalog` responde **404** | imagen vieja, la ruta no existe |
| `POST https://open-crm.tech/webhooks/kapso` responde **404** | ídem |
| `open-crm.tech` → 179.199.155.40, TLS válido | Caddy + Let's Encrypt |
| La rama `whatsapp` no está pusheada | commits solo locales |

`main` **no** contiene estos cambios. El deploy es de la rama `whatsapp`, no de `main`.

## 2. Qué agrega esta versión

Commits a desplegar (en orden, sobre `71e7b48`):

- `c9e61e3` — catálogo público `GET /catalog` (token + rate limit).
- `89d9cc2` — correcciones del catálogo: total de paginación, `Cache-Control: no-store`
  en errores, `min_price <= max_price` y `property_status` por ítem.
- `8cd65c0` — `POST /agent/leads` (contacto, resumen y visita) + prompt y contrato de las
  Function Tools en `agent/kapso-agent-prompt.md`.

Componentes nuevos en tiempo de ejecución:

| Componente | Archivo |
| --- | --- |
| Webhook de Kapso con firma y deduplicación | `src/app/webhooks/kapso/route.ts` |
| Cola de mensajes de WhatsApp (tabla nueva) | `migrations/002-whatsapp.sql` |
| Catálogo público de solo lectura | `src/app/catalog/route.ts`, `src/lib/catalog.ts` |
| Escritura del agente | `src/app/agent/leads/route.ts`, `src/lib/agent.ts` |
| Envío saliente autenticado | `src/app/api/whatsapp/send/route.ts` |
| Worker de la cola | `scripts/worker.ts`, `dist/worker.mjs` |

No hay cambios en PORTAL-LAB que corresponda desplegar acá.

## 3. Configuración que falta en el servidor

Todo va en `/opt/crm-lab/secrets/app.env` (permisos 600, dueño root, nunca en Git ni en stdout).
Las tres claves son **nuevas** y `prepare-app.sh` no las crea porque es un script de primera
instalación: hay que agregarlas a mano.

```bash
cd /opt/crm-lab
umask 077
cat >> secrets/app.env <<EOF
CATALOG_TOKEN=$(openssl rand -hex 32)
AGENT_TOKEN=$(openssl rand -hex 32)
WHATSAPP_AUTOREPLY=off
EOF
```

- `CATALOG_TOKEN`: token de lectura de `GET /catalog`.
- `AGENT_TOKEN`: token de escritura de `POST /agent/leads`. **Distinto** del anterior.
- `WHATSAPP_AUTOREPLY=off`: obligatorio. El workflow `Respuesta basica` de Kapso responde;
  si el CRM también responde, el cliente recibe dos mensajes.

El webhook ya existía en el código pero no en producción. Para que Kapso pueda entregar
eventos, `secrets/app.env` también necesita las claves del canal (no las genera este paso):

| Clave | Origen | Efecto si falta |
| --- | --- | --- |
| `KAPSO_WEBHOOK_SECRET` | `secret_key` real que devuelve Kapso al registrar el webhook | `/webhooks/kapso` responde **503** y no registra nada |
| `KAPSO_API_KEY` | panel de Kapso | solo afecta envíos salientes (`/api/whatsapp/send`) |
| `KAPSO_PHONE_NUMBER_ID` | Meta / Kapso | ídem |

Con `WHATSAPP_AUTOREPLY=off` y el workflow de Kapso respondiendo, el CRM no necesita enviar
mensajes para el flujo del agente; `KAPSO_API_KEY` puede quedar sin configurar y el webhook
sigue funcionando. No inventar valores: si `KAPSO_WEBHOOK_SECRET` no está disponible, dejarlo
sin configurar y aceptar el 503 documentado.

Si `CATALOG_TOKEN` o `AGENT_TOKEN` ya existieran, no los pises: reutilizá el valor vigente y
solo confirmá que esté. Nunca imprimas el valor en logs ni en la salida de un comando.

### Secretos en Kapso

Las funciones ya existen. Cada una necesita el secreto con el **mismo valor** que el CRM:

| Función de Kapso | ID | Secreto |
| --- | --- | --- |
| `crm-search-catalog` | `c3523c8d-2947-4e37-8971-87934b7cde99` | `CATALOG_TOKEN` |
| `crm-save-lead` | `39d3ef0d-20c9-420b-934d-f07a2a601d66` | `AGENT_TOKEN` |

Un token distinto entre CRM y Kapso produce 401. Un CRM sin la variable produce 503.

## 4. Procedimiento

Los comandos suponen acceso como `crmadmin` con `sudo -n` y una copia del repositorio en el
servidor. Ajustá rutas solo si la instalación real difiere; verificá antes de ejecutar.

### Paso 0 — Copia de seguridad y espacio

```bash
sudo systemctl start crm-lab-backup.service
sudo systemctl is-failed crm-lab-backup.service   # debe decir "inactive" o "activating"
df -h /                                            # al menos 5 GB libres
docker system df
```

Si la copia falla, detenerse: no se despliega sin respaldo verificado.
`infra/scripts/verify-app-backup.sh` restaura a una base temporal y la elimina; es la
verificación fuerte y conviene correrla.

### Paso 1 — Código en el servidor, fijado al commit

El branch no está pusheado todavía. Dos caminos válidos:

1. **Con push previo** (decisión del titular): `git fetch origin whatsapp && git checkout 8cd65c0`.
2. **Sin push**: copiar el árbol de trabajo desde la estación del titular y confirmar que
   `git rev-parse HEAD` sea `8cd65c0`. Sin `.git` no hay forma de verificar el commit: en ese
   caso pedir el push antes de continuar.

Verificación local antes de construir (no necesita base de datos):

```bash
cd <ruta-del-repo>/CRM-LAB
npm ci
npm test            # debe dar 22/22
npm run typecheck   # sin salida = OK
```

### Paso 2 — Construir la imagen con tag nuevo

Desde la raíz del repositorio (el Dockerfile copia `CRM-LAB/` y `contracts/`):

```bash
docker build -f CRM-LAB/Dockerfile -t crm-lab:0.2.0 .
```

No reutilizar ni sobrescribir `crm-lab:0.1.0`: es el rollback.

### Paso 3 — Migrar (aplica `002-whatsapp.sql`)

La migración corre desde la imagen nueva, con credenciales administrativas y sin publicar
PostgreSQL:

```bash
docker network ls | grep crm-lab        # confirmar el nombre real de la red *_database

sudo docker run --rm --network <red>_database --user 0 \
  -e TARGET_DATABASE=crm_lab -e AGENCY_NAME=inmolab \
  -e ADMIN_PASSWORD_FILE=/secrets/postgres_password \
  -e APP_PASSWORD_FILE=/secrets/app_password \
  -v /opt/crm-lab/secrets:/secrets:ro \
  crm-lab:0.2.0 node scripts/provision.mjs
```

Debe imprimir `Migración aplicada: 002-whatsapp`. Es aditiva: crea `whatsapp_messages` y sus
índices. Si ya estaba aplicada, no imprime nada y no rompe.

### Paso 4 — Apuntar app y worker a la imagen nueva

En el `compose.app.yaml` desplegado (`/opt/crm-lab/compose.app.yaml`), las **dos** referencias
`image:` (app y worker) deben pasar a `crm-lab:0.2.0`. Validar antes de levantar:

```bash
cd /opt/crm-lab
sudo docker compose -f compose.yaml -f compose.app.yaml config >/dev/null && echo OK
sudo docker compose -f compose.yaml -f compose.app.yaml up -d --wait
sudo docker compose -f compose.yaml -f compose.app.yaml ps
```

`--wait` espera el healthcheck de la app (que consulta PostgreSQL en `/healthz`).

### Paso 5 — Verificación funcional

```bash
# 1. Salud y versión desplegada
curl -s -o /dev/null -w '%{http_code}\n' https://open-crm.tech/healthz          # 200

# 2. Catálogo sin token: 401 (y ya NO 404)
curl -s -o /dev/null -w '%{http_code}\n' https://open-crm.tech/catalog          # 401

# 3. Catálogo con token: 200 y JSON con total/page/pages/items
set -a; . /opt/crm-lab/secrets/app.env; set +a
curl -s -H "Authorization: Bearer $CATALOG_TOKEN" \
  'https://open-crm.tech/catalog?limit=1' | head -c 400; echo

# 4. Filtro inválido: 400
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CATALOG_TOKEN" \
  'https://open-crm.tech/catalog?operation=swap'                               # 400
curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $CATALOG_TOKEN" \
  'https://open-crm.tech/catalog?min_price=100&max_price=50'                    # 400

# 5. Escritura sin token: 401 (y ya NO 404)
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://open-crm.tech/agent/leads  # 401

# 6. Webhook: 401 sin firma si `KAPSO_WEBHOOK_SECRET` está configurado; 503 si falta
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://open-crm.tech/webhooks/kapso  # 401 o 503

# 7. Sesión y administración siguen protegidas
curl -s -o /dev/null -w '%{http_code}\n' https://open-crm.tech/api/state        # 401
```

Criterios de aceptación:

- `/catalog` devuelve `items` y **cada ítem incluye `property_status`** (`available` o
  `reserved`). Si no aparece, la imagen en ejecución es la vieja.
- El JSON de error también trae `Cache-Control: no-store`.
- `items: []` significa "sin coincidencias" (con `total: 0`). Es una respuesta válida, no un
  error: el agente no debe inventar propiedades.
- Paginación: pedir `?page=999` sobre un catálogo con datos devuelve `items: []` **pero
  `total` correcto**, no 0.

### Paso 6 — Prueba de escritura (crea datos reales)

Hace falta un teléfono de prueba acordado con el titular. La llamada crea un contacto si no
existe y, si `visit_requested` es `true`, una actividad de visita. No se puede deshacer desde
la API: usar un número de prueba y avisar quién lo pidió.

```bash
curl -s -w '\n%{http_code}\n' -X POST https://open-crm.tech/agent/leads \
  -H "Authorization: Bearer $AGENT_TOKEN" -H "Content-Type: application/json" \
  -d '{"phone":"+5490000000000","name":"Prueba deploy","summary":"Prueba de despliegue","visit_requested":false}'
```

Esperado: **201** la primera vez (`"created": true`) y **200** si se repite (`"created": false`).
`summary_saved` es `true` una vez y `false` al reintentar el mismo resumen. Probar también
`listing_id` con un `listing_id` real de `/catalog`: `200`/`201`. Y con una oferta no publicada:
**409**.

### Paso 7 — Kapso

1. Confirmar que los secretos de las dos funciones tienen los valores del paso 3.
2. Probar desde el modo Test del workflow `Respuesta basica`:
   - "busco casa en venta en Neuquén hasta 150000 USD" → el agente llama `search_catalog` y
     responde con datos reales; no inventa disponibilidad.
   - "¿está disponible?" sobre una propiedad `reserved` → debe decir reservada.
   - "quiero visitar la del centro" → `save_lead` con `visit_requested: true`; el agente **no**
     debe afirmar que la visita quedó confirmada, solo registrada/solicitada.
   - Pedir algo inexistente → debe decir que no encontró coincidencias, no improvisar.
3. Revisar en el CRM que el contacto, el resumen y la actividad de visita existan.
4. Límites: `/catalog` permite 120 pedidos cada 15 minutos por IP y `/agent/leads` 60. Un test
   intenso puede devolver 429; esperar 15 minutos, no reiniciar contenedores.

## 5. Rollback

```bash
cd /opt/crm-lab
# volver las dos referencias image: a crm-lab:0.1.0
sudo docker compose -f compose.yaml -f compose.app.yaml config >/dev/null
sudo docker compose -f compose.yaml -f compose.app.yaml up -d --wait
```

- `002-whatsapp.sql` **no se revierte**: es aditiva y la versión anterior la ignora.
- No usar `docker compose down -v` ni borrar volúmenes: se pierden base y fotos.
- Si el rollback es por 401/503 en las rutas nuevas, la causa más probable es un secreto
  distinto o faltante, no el código.

## 6. Prohibiciones

- No publicar el puerto de PostgreSQL ni agregar `5432:5432`.
- No imprimir valores de `secrets/app.env` en logs, tickets, chat o salida de comandos.
- No tocar UFW, SSH ni DNS en este despliegue.
- No desplegar desde `main` ni mezclar ramas: los cambios están en `whatsapp`, commit `8cd65c0`.
- No modificar el workflow de Kapso desde el servidor.
- No usar `docker compose down -v`, `docker volume rm` ni `DROP TABLE` sobre `whatsapp_messages`.

## 7. Pendientes que este runbook no resuelve

| Pendiente | Responsable | Nota |
| --- | --- | --- |
| Push de la rama `whatsapp` | titular | sin push, el servidor depende de una copia manual |
| Valores de `CATALOG_TOKEN` y `AGENT_TOKEN` en Kapso | titular / Kapso | deben coincidir con el CRM |
| `KAPSO_WEBHOOK_SECRET` en producción | titular / Kapso | sin él el webhook responde 503 |
| Aprobación del display name de WhatsApp | Meta | sin eso los envíos reales fallan (#131037) |
| Prueba end-to-end desde el modo Test | titular / Kapso | recién posible después del deploy |
| `WHATSAPP_AUTOREPLY=off` en producción | este despliegue | verificarlo en `secrets/app.env` |
| Caddy con `header_up X-Real-IP {remote_host}` | este despliegue | si falta, `limited()` agrupa a todos como `local` y los límites pasan a ser globales |

## 8. Checklist final

- [ ] Copia de seguridad ejecutada y verificada.
- [ ] Código en `8cd65c0`, `npm test` 22/22, `typecheck` OK.
- [ ] `crm-lab:0.2.0` construida; `crm-lab:0.1.0` intacta.
- [ ] `schema_migrations` contiene `002-whatsapp`.
- [ ] `secrets/app.env` con `CATALOG_TOKEN`, `AGENT_TOKEN`, `WHATSAPP_AUTOREPLY=off`.
- [ ] Compose validado y app + worker en `0.2.0`, ambos `healthy`.
- [ ] `/catalog` 401 sin token, 200 con token, `property_status` presente, 400 con filtros inválidos.
- [ ] `/agent/leads` 401 sin token, 201/200 con token, 409 con oferta no publicada.
- [ ] `/webhooks/kapso` 401 sin firma (o 503 documentado si falta `KAPSO_WEBHOOK_SECRET`).
- [ ] `/api/state` sigue en 401.
- [ ] Secretos de Kapso cargados y recorrido probado en modo Test.
- [ ] Contacto, resumen y visita visibles en el CRM.

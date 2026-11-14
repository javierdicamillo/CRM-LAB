# Kapso agent catalog route — read-only GET for published offers

Branch `whatsapp` · delivery strategy `ask-on-risk` · test runner `npm test` (node:test + tsx).

## Specs

- **S1** — The CRM must expose a public read route for the Kapso agent: "La ruta pendiente tiene que ser un GET sin sesión pero con token y limited() de security.ts". Acceptance: `GET /catalog` runs without a session, rejects requests without a valid token, and applies `limited()` from `src/lib/security.ts`.
- **S2** — Result set: "devolviendo solo ofertas con data->>'publication' = 'published' cuya propiedad esté available/reserved y tenga al menos una foto aprobada (mismas condiciones de enqueue() en business.ts:33-35)". Acceptance: an offer appears only when its `data->>'publication'` is `published`, its property `data->>'status'` is `available` or `reserved`, and the property has at least one `photos.approved` row.
- **S3** — Search filters: "con filtros de texto/ciudad/operación/tipo/precio para que el agente pueda buscar." Acceptance: query parameters filter by free text, city, operation, property type and price range; invalid filter values return HTTP 400.
- **S4** — The response must not leak private data. Acceptance: each item is built with `publicListing(property, offer)` (same projection used by the portal sync) plus `listing_id`; no owner, private address, private notes or cadastre geometry.

Assumptions (not stated by the user):
- Path `/catalog`, token in `Authorization: Bearer <token>`, secret in `CATALOG_TOKEN`.
- Response `{ total, page, pages, items }`, `limit` 1–50 (default 12), `page` ≥ 1.
- `min_price` / `max_price` compare the offer `amount`; optional `currency` narrows the range.

## Tasks

| ID | Spec | Route | Status | Evidence |
| --- | --- | --- | --- | --- |
| T1 | S1-S4 | inline | done | `npm test` 14/14, `npm run typecheck` OK; independent verifier unavailable (`subagent` permission denied) |

## Log

- **L1** (user, verbatim):

  > volvamos a lo de hoy, a entender que Estado real de la ruta: no existe. En src/app solo hay api/* (todo detrás de actor() con sesión), healthz y webhooks/kapso. El catálogo hoy solo sale hacia PORTAL-LAB por outbox + sync.ts; el CRM no expone ninguna lectura pública.
  > La ruta pendiente tiene que ser un GET sin sesión pero con token y limited() de security.ts, devolviendo solo ofertas con data->>'publication' = 'published' cuya propiedad esté available/reserved y tenga al menos una foto aprobada (mismas condiciones de enqueue() en business.ts:33-35), con filtros de texto/ciudad/operación/tipo/precio para que el agente pueda buscar.
- **L2**: Confirmed current state: `src/app` has only `api/*`, `healthz` and `webhooks/kapso`; catalog leaves only through `outbox` + `src/lib/sync.ts`. Route does not exist.
- **L3**: Implemented `GET /catalog` (`src/app/catalog/route.ts`) and `src/lib/catalog.ts`; tests written first in `tests/catalog.test.ts`. `npm test` 14/14 and `npm run typecheck` OK. RED could not be observed cleanly: the first test run failed on an esbuild platform mismatch (Windows `node_modules` under WSL), fixed by installing the linux esbuild binaries into `node_modules`; the new tests then passed with the implementation. Independent verifier blocked: `subagent` tool returns permission denied. DB unavailable locally (127.0.0.1:5432 refused), so S2 is covered by static SQL review plus the enqueue() conditions, not by a live query.
- **L4** (post-review fixes): Replaced `count(*) OVER()` with a separate count query so `total` stays correct on out-of-range pages (`src/lib/catalog.ts`); `catalogParams` now rejects `min_price > max_price` with 400; `GET /catalog` sets `Cache-Control: no-store` on error responses (`src/app/catalog/route.ts`). Tests added first (RED observed: 3 failing) covering the publication/status/approved-photo SQL invariants, private-field exclusion, deep-page total, and inverted price range. `npm test` 17/17, `npm run typecheck` OK. Not deployed: production `GET https://open-crm.tech/catalog` still returns 404.
- **L5**: `GET /catalog` ahora devuelve `property_status` por ítem (available/reserved), fuera de `publicListing()` para no romper el contrato `PublishedUpdate` del portal. Nueva escritura separada `POST /agent/leads` (`src/app/agent/leads/route.ts` + `src/lib/agent.ts`): token `AGENT_TOKEN`, `limited()`, valida con zod estricto, crea o actualiza contacto por teléfono, guarda resumen sin duplicar reintentos y registra la visita con la misma forma que `enqueue()`/`applyLeadActions` (helper `createVisitActivity`). Una `listing_id` no publicada devuelve 409 reutilizando la condición de visibilidad del catálogo (`publicListingById`). Prompt y contrato de herramientas en `agent/kapso-agent-prompt.md`. Tests: 21/21, typecheck OK. Sigue sin desplegar.

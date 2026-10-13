# PORTAL-LAB 0.1.0

Portal inmobiliario público implementado en Next.js/React/TypeScript. Mantiene su propio catálogo PostgreSQL y recibe únicamente fichas autorizadas de CRM-LAB. **Implementación local: todavía no desplegada ni conectada al CRM de producción.**

## Disponible

- Catálogo paginado con búsqueda por título, ciudad o barrio, operación y tipo.
- Fichas con galería, datos comerciales, página por inmobiliaria y formulario de consulta.
- Protocolo LAB 1.0/1.1: capacidades, medios, publicaciones/retiros, índice, reconciliación, entrega y confirmación de consultas.
- Credenciales independientes por inmobiliaria, almacenadas como SHA-256; revocación operativa, aislamiento por agencia y validación estricta de entradas.
- Revisión creciente, repeticiones idempotentes, límite de 1.000 ofertas activas por inmobiliaria. La reconciliación debe coincidir exactamente para renovar la vigencia de 72 horas. Las fichas y sus imágenes dejan de estar disponibles si vencen, se retiran o se suspende la agencia.
- Fotografías recodificadas a WebP sin EXIF, conservadas en PostgreSQL (`bytea`), no en un servicio externo. Límite de 10 MB/25 MP por subida y 5 GB/30.000 medios por agencia. El backup de la base incluye las imágenes.
- Referencia catastral opcional, autorizada desde el CRM, con nomenclatura y contorno oficial de parcela.

## Catastro de Neuquén

Fuente comprobada el 13/10/2026: [DPCeIT · IDE/Catastro/MapServer/4](https://catastro.neuquen.gov.ar/server/rest/services/IDE/Catastro/MapServer/4). La [información oficial de ITC](https://dpc.neuquen.gov.ar/Home/SistemaITC) indica acceso público básico sin clave.

El adaptador compartido `../contracts/cadastre.ts` consulta una nomenclatura exacta de **15 dígitos de parcela**, en EPSG:4326. Solo pide nomenclatura, identificador, localidad, departamento, tipo y geometría; no solicita propietarios, títulos ni información fiscal. No descarga toda la base. Ante ambigüedad, geometría inesperada o indisponibilidad, devuelve un error y no inventa una asociación.

En CRM: editar propiedad → nomenclatura → Consultar Catastro → verificar correspondencia → guardar. La referencia permanece privada por defecto. Marcar «Autorizar publicación…» permite enviar nomenclatura y ubicación exacta al portal. Guardar con un número diferente vuelve a consultar; vaciarlo elimina el vínculo y su autorización. La consulta previa del formulario no guarda cambios.

El portal consulta nuevamente la referencia al recibirla por primera vez y conserva una instantánea con fecha. No se garantiza actualización catastral en tiempo real. La capa es de parcelas: no verifica unidades funcionales, titularidad, superficie de la unidad ni situación jurídica. La relación parcela/inmueble es declarada por la inmobiliaria. El protocolo 1.1 agrega el campo opcional `cadastre`; el CRM no lo envía a un portal que solo anuncie 1.0.

## Desarrollo y vista local

Node 24. Desde esta carpeta:

```sh
npm ci
npm run preview
```

Abrir `http://127.0.0.1:3100`. La vista local utiliza PostgreSQL embebido (PGlite) en `.local-db/`, ignorado por Git. Crea solamente propiedades ficticias identificadas como demostración. No utiliza la base ni las credenciales de `open-crm.tech`. Para un catálogo vacío, usar una base PostgreSQL de desarrollo con la configuración siguiente, sin ejecutar `preview`.

```sh
# Completar .env.local con DATABASE_URL y PORTAL_ORIGIN locales.
node --env-file=.env.local --import tsx scripts/migrate.ts
npm run dev
```

La base embebida está deshabilitada en producción. No abrir `.local-db` desde dos procesos al mismo tiempo.

## Verificación

```sh
npm run typecheck
npm test
npm run build
npm audit --omit=dev --audit-level=high
```

Las pruebas utilizan PostgreSQL embebido aislado y Requests HTTP para ejecutar los handlers reales; comprueban contratos OpenAPI, idempotencia, separación entre agencias, autorización de fotos, conflictos, consultas/ACK, retiros y expiración. Las pruebas catastrales simulan fallos oficiales; se realizó además una consulta real de lectura. No equivalen a una prueba de carga ni a una restauración del VPS.

## Despliegue para Hostinger

Preparado para el servidor independiente previsto en la arquitectura. Desde la **raíz del repositorio**, no desde esta carpeta:

```sh
docker build -f PORTAL-LAB/Dockerfile -t portal-lab:0.1.0 .
# El CRM también necesita el contexto raíz por el adaptador compartido:
docker build -f CRM-LAB/Dockerfile -t crm-lab:0.2.0 .
```

Configuración: `../infra/portal-lab/compose.yaml` y `Caddyfile`. Este Compose expone 80/443 y no debe iniciarse junto al Caddy existente del CRM en el mismo servidor sin adaptar redes y proxy. No se modificó producción. Las imágenes PostgreSQL/Caddy se seleccionan por digest en el `.env` operativo. La imagen base Node debe fijarse al digest aprobado antes del despliegue.

1. Crear una base `portal_lab`, un rol propietario para migraciones y un rol `portal_app` sin superusuario para ejecución. Aplicar la migración con el propietario; conceder a `portal_app` CONNECT a la base, USAGE al esquema y SELECT/INSERT/UPDATE/DELETE a las tablas. No usar la credencial administrativa en la aplicación.
2. Crear `secrets/app.env` con `DATABASE_URL`, `PORTAL_ORIGIN=https://DOMINIO_ELEGIDO` y `PORTAL_CONTACT_EMAIL` real. Sin correo de contacto válido, las consultas públicas permanecen deshabilitadas en producción. Las migraciones usan un archivo separado `secrets/migration.env`, que nunca se monta en la aplicación.
3. Iniciar solamente PostgreSQL. Ejecutar la migración en la imagen con las credenciales de migración: `node dist/migrate.js`. El UUID de la instancia se genera una vez y persiste en PostgreSQL; no cambia al reiniciar.
4. Provisionar cada inmobiliaria con `node dist/agency.js create slug "Nombre comercial"`. Opcionalmente definir `AGENCY_EMAIL` y `AGENCY_PHONE`. Entrega el token una sola vez; guardarlo en el archivo privado del CRM. `suspend slug` revoca acceso y oculta sus publicaciones; `rotate slug` reemplaza el token. No poner tokens en argumentos, Git, tickets o capturas.
5. Configurar en cada CRM `PORTAL_URL`, `PORTAL_TOKEN` y `PORTAL_INSTANCE_ID`; actualizar app y worker juntos. El conector existente originará los envíos. Antes de activar, respaldar y verificar el CRM y revisar las fichas/fotos autorizadas.
6. Iniciar app y Caddy; verificar `/healthz`, un envío, una consulta y el ACK desde un CRM de prueba. Programar `node dist/maintenance.js` diariamente. El comando borra consultas confirmadas de más de siete días y reporta pendientes de más de treinta; no descarta consultas sin entregar.
7. Configurar backup externo cifrado, retención y restauración comprobada de la base (incluye fotos, consultas, identidad y tokens hasheados), junto con secretos y configuración. No copiar la base local de demostración.

La imagen conserva el directorio de trabajo `/app/PORTAL-LAB`; los comandos operativos se ejecutan allí. La app no publica su puerto directamente: Caddy sustituye X-Real-IP para los límites por dirección. Definir recursos y medir capacidad antes de compartir el VPS piloto.

## Límites pendientes de operación

Dominio y servidor de destino, despliegue real, backups externos, alertas de consultas demoradas y almacenamiento, retención de copias, prueba CRM→portal→CRM en servidores separados y revisión de condiciones de redistribución cartográfica para la puesta pública. No se implementó un panel web de administración del portal: altas/suspensiones/rotación son comandos del operador. La separación entre agencias se aplica en las consultas del servidor y sus pruebas; no se implementó RLS de PostgreSQL.

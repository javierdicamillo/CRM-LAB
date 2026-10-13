# CRM-LAB

Versión 0.1.0: CRM inmobiliario privado autoalojado, en español y con una inmobiliaria por instalación. Piloto: https://open-crm.tech. Código bajo [AGPL-3.0-only](LICENSE).

## Responsabilidades

Propiedades, propietarios, contactos, ofertas de venta y alquiler, fotos originales y derivadas, usuarios, roles, oportunidades, actividades, agenda, auditoría y exportaciones JSON/CSV/ZIP. El administrador decide qué datos y fotografías se publican. Los miembros activos comparten los registros comerciales de su inmobiliaria; un agente no administra usuarios ni exporta la base completa. Sucursales con permisos propios quedan para otra versión.

Cada instalación incluye aplicación, PostgreSQL local, almacenamiento persistente y proceso de sincronización. El mismo código y migraciones se distribuyen a las ocho instalaciones; marca y configuración cambian mediante parámetros, sin ocho forks.

## Comunicación

CRM-LAB envía fichas públicas a PORTAL-LAB y consulta periódicamente las consultas pendientes. Todas las conexiones de integración se originan en el CRM. El portal no escribe directamente en sus tablas privadas. Ver [contrato](../contracts/README.md) y [protocolo](../docs/03-contrato-y-sincronizacion.md).

Cada CRM conserva originales de fotos, información privada, seguimiento comercial, copias locales de las consultas recibidas y trabajos pendientes. Una caída del portal permite continuar la gestión interna; las nuevas publicaciones esperan en la cola.

## Fuera del MVP

Contabilidad, administración contractual de alquileres, facturación SaaS, app nativa, bandeja omnicanal completa, IA autónoma y conectores a todos los portales comerciales. Tampoco hay MFA ni recuperación de contraseña por correo. El administrador puede restablecer cuentas del equipo; la recuperación del único administrador requiere operación del servidor.

## Desarrollo

Node.js 24, Next.js 16, React 19, TypeScript, PostgreSQL 18, Better Auth, Drizzle/pg, Zod y Sharp. Docker Compose y Caddy en el servidor. No requiere una API de IA ni un servicio de pago adicional.

1. Crear una base PostgreSQL local de desarrollo, distinta de producción.
2. Copiar `.env.example` a `.env.local` y completar valores privados. Generar secretos aleatorios nuevos; nunca reutilizar los del piloto.
3. Ejecutar `npm ci`. Aplicar migraciones con `node --env-file=.env.local --import tsx scripts/migrate.ts`, usando credenciales de migración. Luego usar un rol limitado para ejecutar la aplicación.
4. Ejecutar `npm run dev`. Activar una vez desde `http://localhost:3000/#activar=TOKEN_LOCAL`, con el token definido localmente.

Next carga `.env.local`; los scripts independientes necesitan variables exportadas o `--env-file`. Consultar los scripts antes de apuntarlos a una base existente.

## Verificación y operación

Ejecutar `npm run typecheck`, `npm test`, `npm run build` y `npm audit --omit=dev`. Las pruebas unitarias validan fichas contra OpenAPI. `scripts/integration.mjs` verifica el recorrido HTTP en una instalación **exclusivamente de prueba**. `scripts/protocol-test.mjs` usa un portal simulado y `dist/worker.mjs`; no ejecutar ninguno contra producción. La configuración aislada está en `../infra/crm-base/compose.test.yaml`.

Los 41 controles HTTP, cuatro pruebas unitarias, build, tipos y pruebas de fallos del protocolo pasaron el 9/10/2026. No sustituyen una auditoría independiente ni las pruebas de carga y compatibilidad con el portal real.

Despliegue y recuperación: [infraestructura](../infra/README.md) y [guía del piloto](../docs/09-entrega-crm-mvp.md). Datos, fotos, secretos y backups no pertenecen a Git. En el piloto todavía no hay un portal configurado: las publicaciones quedan en cola.

La pantalla carga hasta 20.000 registros comerciales; agregar paginación antes de superar ese volumen. Fotos: hasta 30 por inmueble y 10 MB por archivo. Cada inmobiliaria tendrá su propio servidor y debe incorporarse gradualmente; este piloto no certifica la capacidad del conjunto de ocho agencias.

## Cambios locales para PORTAL-LAB y Catastro

Se agregó consulta de parcela por nomenclatura de 15 dígitos de Neuquén. El vínculo se comprueba contra DPCeIT al guardar y permanece privado por defecto. La autorización explícita permite publicarlo usando protocolo 1.1. No verifica titularidad ni unidades funcionales. Estos cambios todavía no están desplegados en el piloto.

El Dockerfile ahora se construye desde la raíz del repositorio: `docker build -f CRM-LAB/Dockerfile -t crm-lab:0.2.0 .`, para incluir `contracts/cadastre.ts`. App y worker deben actualizarse juntos. El directorio de trabajo de la imagen sigue admitiendo `node dist/worker.mjs`.

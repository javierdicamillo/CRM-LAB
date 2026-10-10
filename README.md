# CRM-LAB y PORTAL-LAB

Arquitectura v2 · 9 de octubre de 2026 · MVP para ocho inmobiliarias

**Dos productos independientes: ocho instalaciones de CRM-LAB, cada una en un VPS propio, y un PORTAL-LAB común en un noveno VPS.** El mismo código de CRM se distribuye a las ocho inmobiliarias. Sus bases, usuarios, archivos privados y credenciales permanecen separados.

PORTAL-LAB implementa el contrato público de CRM-LAB: recibe únicamente fichas autorizadas y devuelve las consultas a su inmobiliaria. Conserva un catálogo local para no depender de ocho servidores en cada búsqueda.

El usuario confirmó que el presupuesto debe incluir ocho VPS nuevos para los CRM. El portal requiere infraestructura adicional, incluida en el presupuesto propuesto.

## Organización del proyecto

| Área | Contenido |
| --- | --- |
| [CRM-LAB](CRM-LAB/README.md) | Responsabilidades del producto privado |
| [PORTAL-LAB](PORTAL-LAB/README.md) | Catálogo público y captación |
| [Contrato compartido](contracts/README.md) | API versionada y compatibilidad |
| [Infraestructura](infra/README.md) | Despliegue previsto para nueve servidores |
| [Resumen del laboratorio](docs/00-resumen-ejecutivo.md) | Explicación breve |
| [Arquitectura](docs/01-arquitectura.md) | Separación y propiedad de datos |
| [Stack y servicios](docs/02-stack-y-servicios.md) | Herramientas abiertas y ahorro |
| [Sincronización](docs/03-contrato-y-sincronizacion.md) | Publicaciones, fotografías y consultas |
| [Costos](docs/04-costos.md) | Nueve VPS, renovación y exclusiones |
| [Operación y GitHub](docs/05-operacion-y-github.md) | Versiones, seguridad y respaldo |
| [MVP y laboratorio](docs/06-mvp-y-laboratorio.md) | Alcance, pruebas y hoja de ruta |
| [Decisiones y fuentes](docs/07-decisiones-y-fuentes.md) | Cambios respecto de v1 y evidencia |

## Estado actual

CRM-LAB 0.1.0 está desplegado en **https://open-crm.tech** para **inmolab**, con HTTPS, autenticación, propiedades, fotos, contactos, oportunidades, agenda, roles y exportaciones. La primera cuenta requiere activación privada por el titular. La instalación comienza sin datos de prueba.

Ver la [entrega, pruebas y guía de uso](docs/09-entrega-crm-mvp.md) y el [registro de infraestructura](docs/08-vps-piloto.md). El conector pasó pruebas contra un portal simulado; PORTAL-LAB real sigue pendiente. Hay copias locales cifradas, pero todavía no un respaldo externo automático. Repositorio público: [javierdicamillo/CRM-LAB](https://github.com/javierdicamillo/CRM-LAB). El workflow valida tipos, pruebas, build y dependencias; su estado se consulta en GitHub Actions.

La propuesta anterior de CRM con base multicliente compartida queda sustituida. Se conserva en el [histórico v1](docs/historico/v1/README.md). El pedido inicial permanece en Promptinicial.txt.

## Decisiones centrales

- Una inmobiliaria por instalación CRM-LAB, con varios usuarios y sucursales.
- PORTAL-LAB agrega ocho catálogos y entrega consultas a su origen.
- HTTPS, JSON y OpenAPI; ninguna conexión remota a las bases de los CRM.
- Next.js, TypeScript, Node.js, PostgreSQL, Caddy y Docker Compose en Linux.
- Disco persistente y copias externas; sin Redis, Chatwoot, Kubernetes ni IA obligatoria en el MVP.
- Monorepo GitHub con productos, builds, versiones y despliegues separados.

Primera prueba: dos CRM ficticios y un portal, incluyendo aislamiento, desconexión y recuperación. Después se amplía gradualmente a las ocho inmobiliarias.

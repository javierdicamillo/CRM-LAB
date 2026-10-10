> HISTÓRICO — Diseño v1 sustituido el 9 de octubre de 2026. Consultar el README de la raíz para la arquitectura vigente de ocho CRM independientes y un portal.

# Fuentes y registro de decisiones

Consulta realizada el 8 de octubre de 2026. Las fuentes son públicas y primarias. Las páginas de proveedores pueden cambiar; volver a comprobar límites, licencias y disponibilidad cuando se contrate o fijen versiones. La consulta documental no sustituye una prueba en una cuenta de Hostinger ni una demostración contratada de Tokko.

## Fuentes consultadas

| Fuente | Qué respalda |
| --- | --- |
| [Tokko Broker Argentina](https://www.tokkobroker.com/es-ar/) | Sitio web integrado, oportunidades y difusión |
| [Funciones Tokko](https://blog.tokkobroker.com/7-funcionalidades-de-tokko-broker) | Familias funcionales del CRM; artículo comercial del proveedor |
| [Centro de ayuda Tokko](https://dudas.tokkobroker.com/es) | Organización de módulos, permisos e integraciones; advertencia territorial en sección móvil |
| [API de contactos](https://developers.tokkobroker.com/docs/contactos) | Uso de clave, propiedades e ingreso de consultas |
| [Guía API de propiedades](https://developers.tokkobroker.com/docs/pegadas-utiles-a-la-api) | Paginación y limitaciones de solicitudes |
| [Node.js en Hostinger](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/) | Opciones administradas y VPS |
| [Despliegue Node.js](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/) | GitHub, frameworks y configuración de aplicación |
| [Bases en Hostinger](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/) | PostgreSQL en VPS y distinción respecto de Web y Cloud |
| [Twenty](https://github.com/twentyhq/twenty) y [licencia](https://github.com/twentyhq/twenty/blob/main/LICENSE) | CRM existente y régimen de licencias mixto |
| [Frappe CRM](https://github.com/frappe/crm) | Framework, interfaz, licencia e instalación |
| [Versiones Node.js](https://nodejs.org/en/about/previous-releases) | Estado LTS de la rama 24 |
| [Next.js autoalojado](https://nextjs.org/docs/app/guides/self-hosting) | Posibilidad de ejecución fuera de un proveedor único |
| [PostgreSQL RLS](https://www.postgresql.org/docs/current/ddl-rowsecurity.html) | Políticas de filas y excepciones de privilegios |
| [Drizzle RLS](https://orm.drizzle.team/docs/rls) | Declaración de políticas de base de datos |
| [Better Auth](https://better-auth.com/docs/plugins/organization) | Organizaciones y membresías |
| [GitHub ramas protegidas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches) | Revisiones, checks y disponibilidad por plan |
| [AGPL en OSI](https://opensource.org/license/agpl-3.0) | Condiciones de la licencia propuesta |
| [Next.js MIT](https://github.com/vercel/next.js/blob/canary/license.md) | Licencia consultada del framework |
| [Better Auth MIT](https://raw.githubusercontent.com/better-auth/better-auth/main/LICENSE.md) | Licencia consultada de identidad |
| [Drizzle Apache-2.0](https://raw.githubusercontent.com/drizzle-team/drizzle-orm/main/LICENSE) | Licencia consultada del ORM |
| [PostgreSQL License](https://www.postgresql.org/about/licence/) | Licencia de la base de datos |

## Decisiones propuestas

| ID | Propuesta | Razón | Revisar cuando |
| --- | --- | --- | --- |
| D01 | Producto propio sobre bibliotecas abiertas | Inventario y experiencia integrados | El equipo no pueda mantener el núcleo |
| D02 | Monolito modular Next.js | Reducir cantidad de servicios al inicio | Carga o equipos requieran despliegues independientes |
| D03 | PostgreSQL compartido con RLS | Equilibrar aislamiento y operación del piloto | Contratos exijan bases separadas |
| D04 | Node.js administrado con base externa, condicionado a prueba | Facilitar inicio sin administrar Linux | Conectividad o trabajos no cumplan |
| D05 | VPS como alternativa operativa | Control sobre base y procesos | Se confirme responsable de operación |
| D06 | Portal propio antes de conectores externos | Entregar el circuito básico sin depender de acuerdos | Haya un proveedor autorizado y presupuesto |
| D07 | AGPL-3.0 para el código propio | Favorecer apertura de modificaciones ofrecidas por red | Se defina el modelo de reutilización y titularidad |
| D08 | IA opcional y supervisada | Evaluar beneficio sin condicionar el CRM | Los experimentos demuestren calidad y costo aceptables |

Son recomendaciones documentadas; no representan decisiones aprobadas por el equipo ni funcionalidades implementadas.

## Información por resolver

| Dato | Impacto | Responsable sugerido |
| --- | --- | --- |
| Plan de Hostinger contratado | Arquitectura de despliegue y costo | Titular de la cuenta |
| Inmobiliarias, usuarios y concurrencia esperada | Capacidad y prueba de carga | Producto |
| Presupuesto y dedicación del equipo | Calendario y sostenibilidad | Coordinación del laboratorio |
| Organización GitHub y colaboradores | Permisos y revisiones | Responsable técnico |
| Países, dominios y marcas | Configuración y tratamiento de datos | Producto |
| Licencia definitiva y titularidad | Publicación y contribuciones | Responsables del proyecto |
| Datos existentes y uso actual de Tokko | Migración o convivencia | Referente inmobiliario |
| Portales imprescindibles | Integraciones y acuerdos | Referente comercial |

## Evidencia de esta etapa

Se inspeccionó la carpeta de trabajo, que contenía el pedido original; se contrastaron fuentes oficiales y se preparó la propuesta. No se accedió a cuentas de clientes, no se ejecutó un benchmark y no se validaron despliegues. Los siguientes resultados a registrar son: commit del prototipo, entorno utilizado, pruebas de aislamiento y acta de recuperación.

> HISTÓRICO — Diseño v1 sustituido el 9 de octubre de 2026. Consultar el README de la raíz para la arquitectura vigente de ocho CRM independientes y un portal.

# Colaboración en GitHub y operación

## Organización del equipo

Proponer una organización GitHub con un repositorio principal. Asignar una persona de producto que valide el uso inmobiliario, responsables de desarrollo y una persona con capacidad de revisar seguridad y operación. En un equipo pequeño se pueden combinar funciones, manteniendo revisión cruzada.

Cada colaborador utiliza su cuenta individual y autenticación de dos factores. Conceder el permiso mínimo necesario. Las cuentas GitHub son para construir el producto; los usuarios del CRM se administran desde el aplicativo.

GitHub admite protección de ramas en repositorios públicos con planes Free; para repositorios privados la disponibilidad depende del plan. Verificarlo antes de elegir la visibilidad. [Documentación de ramas protegidas](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## Flujo de una entrega

1. Abrir una tarea con problema, alcance y criterios de aceptación.
2. Crear una rama corta desde `main`, por ejemplo `feat/consulta-publica`.
3. Implementar y registrar la ayuda de IA cuando corresponda.
4. Abrir un pull request que vincule la tarea y muestre evidencia.
5. Ejecutar verificaciones y solicitar revisión de otra persona.
6. Fusionar únicamente con controles aprobados y conversaciones resueltas.
7. Probar en staging, etiquetar la versión y promover el mismo commit validado a producción.

Proteger `main` contra borrado y push forzado, exigir al menos una revisión y checks requeridos. Para cambios de identidad, políticas de datos y exportaciones, asignar revisión de la persona responsable de seguridad. Configurar CODEOWNERS cuando existan los nombres reales de equipo; un archivo con usuarios inventados no ofrece protección.

## Estructura prevista

```text
README.md
LICENSE                       # incorporar al adoptar la licencia
CONTRIBUTING.md
docs/                         # evaluación, decisiones y operación
src/app/                      # portal, CRM y endpoints
src/modules/                  # reglas de negocio por módulo
src/lib/auth/                 # integración de identidad
src/lib/db/                   # esquema y acceso a datos
db/migrations/                # cambios SQL y políticas RLS
tests/                        # integración, permisos y recorridos
.github/workflows/            # CI cuando exista aplicación
.github/ISSUE_TEMPLATE/
.github/pull_request_template.md
.env.example                  # nombres de variables sin secretos
```

La estructura de código es una propuesta; solo la documentación y las plantillas de colaboración se incluyen en esta entrega.

## Integración continua

Al existir código, cada PR debe verificar instalación reproducible con archivo de bloqueo, formato, tipos, pruebas de negocio y compilación. Levantar PostgreSQL temporal para verificar migraciones e aislamiento; ejecutar un recorrido de publicación y consulta con datos ficticios.

En revisiones externas no entregar secretos de producción a código de un fork. Separar pruebas sin privilegios del despliegue con credenciales restringidas. Programar revisión de dependencias y alertas de seguridad, con responsables de resolverlas.

No crear ahora un workflow que aparente validar una aplicación inexistente. Las plantillas documentales permiten empezar la planificación sin producir checks vacíos.

## Prueba de alojamiento

| Verificación | Evidencia a guardar |
| --- | --- |
| Plan habilitado para Node.js | Nombre del plan y capacidades observadas, sin datos sensibles |
| Compilación y arranque | Commit, versión de Node y registros sin secretos |
| PostgreSQL externo por TLS | Consulta de prueba, latencia y límites de conexiones |
| Variables de entorno | Persistencia tras redespliegue; separación staging y producción |
| Imágenes | Subida, lectura autorizada y persistencia tras redespliegue |
| Tarea programada | Ejecución, fallo simulado, reintento y ausencia de duplicados |
| Publicación y retirada | Ficha y listado coherentes después del cambio |
| Recuperación | Aplicación anterior restaurada y copia de datos validada |

La guía de Hostinger documenta despliegue mediante GitHub y configuración del build. Ese despliegue automático no debe convertirse en una vía para publicar un commit que aún no pasó los controles. [Guía oficial](https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/).

Usar `main` para staging. Para producción, elegir la función disponible de promoción manual del commit validado o una rama protegida de publicación cuya selección en Hostinger se haya comprobado. Si no existe promoción segura en el plan, documentar un procedimiento manual o elegir VPS. No asumir que Hostinger espera automáticamente el resultado de GitHub Actions.

## Despliegue y recuperación

Separar desarrollo, staging y producción con bases, archivos y credenciales diferentes. En VPS se propone empaquetar web y ejecutor como contenedores, usar proxy HTTPS, cerrar accesos públicos a la base y conservar volúmenes persistentes. Una referencia inicial de 2 vCPU y 4 GB de RAM es solo un punto de prueba; dimensionar con mediciones y evitar builds pesados junto a la base productiva.

Aplicar migraciones como paso controlado y exclusivo del despliegue. No ejecutar migraciones destructivas desde cada proceso web al arrancar. Preferir cambios compatibles en etapas: agregar campos, migrar datos, desplegar lectores nuevos y retirar lo viejo después.

Un rollback de código no revierte automáticamente el esquema ni los datos. Antes de cambiar estructura, registrar compatibilidad, copia previa y plan de recuperación. Practicarlo en staging.

Objetivos propuestos para el piloto: pérdida máxima de 24 horas de datos y recuperación en 4 horas. No son garantías del proveedor. Programar respaldos diarios cifrados, copia fuera del servidor y restauración mensual; revisar un esquema más frecuente cuando haya operaciones reales que no toleren esa pérdida. Conservar inicialmente 14 copias diarias y 3 mensuales, sujeto a presupuesto y política de retención.

Monitorear disponibilidad, errores, latencia, fallos de login, uso de disco, conexiones, antigüedad de tareas y éxito de respaldos. Designar responsable y canal de incidentes antes de ingresar datos reales.

## Datos y salida del servicio

Definir aviso de privacidad, finalidad, acceso, conservación, exportación y eliminación con los responsables de cada inmobiliaria. Revisar las obligaciones que correspondan al país y a los proveedores elegidos antes del piloto real. La documentación pública del código nunca debe incluir la base de clientes, documentos, API keys ni copias productivas.

Al dar de baja una organización, retirar sus publicaciones, cancelar sesiones, detener tareas, permitir la exportación acordada y aplicar el plazo de eliminación. Documentar cómo expiran los datos en copias de seguridad y evitar que una restauración reactive registros eliminados.

Con una base compartida, restaurar una sola inmobiliaria no es tan simple como restaurar toda la base. Para recuperar solo un tenant, restaurar primero la copia en una instancia aislada y extraer sus registros y archivos con validación de relaciones. Nunca sobrescribir producción completa para resolver un error de un solo cliente.

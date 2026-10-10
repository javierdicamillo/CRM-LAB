# Operación de nueve servidores y colaboración

## Repositorio y versiones

Un monorepo inicial con `CRM-LAB/`, `PORTAL-LAB/`, `contracts/`, `infra/` y `docs/`. Separación de aplicaciones no obliga a separar repositorios: el contrato compartido se revisa junto a ambos consumidores y se reducen cambios incompatibles. Crear dos builds e imágenes y liberar versiones independientes, por ejemplo `crm-v0.1.0` y `portal-v0.1.0`.

Si más adelante distintos equipos requieren repositorios separados, publicar el contrato y SDK como un paquete versionado. No crear ocho forks del CRM: cada instalación usa configuración y una versión mantenida del mismo producto.

GitHub: tareas por producto, responsables de contrato e infraestructura, ramas cortas y PR revisado por otra persona. Proteger main, exigir checks y no permitir push directo a producción. Revisar disponibilidad de protecciones según plan y visibilidad. [GitHub](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches).

## Configuración por inmobiliaria

Inventario privado con agencia, dominio, región, versión CRM, versión de protocolo, contacto operativo, último backup, última restauración y última sincronización. Cada servidor usa secretos, credenciales de base y repositorio de respaldo propios. El dueño conserva control de su cuenta de hosting; el laboratorio recibe solo permisos acordados.

Separar staging de producción. Para ahorrar, ejecutar pruebas con múltiples contenedores y bases ficticias en desarrollo o CI; las ocho instancias reales se alojarán en ocho VPS diferentes. No usar datos personales reales en GitHub, demos ni herramientas de IA.

## Instalación repetible

Usar Ubuntu mantenido, firewall, SSH por clave y acceso de administración limitado. Caddy expone HTTPS; PostgreSQL no publica su puerto a Internet. Ejecutar aplicaciones como usuario sin privilegios. Persistir base, fotos y configuración fuera de las capas reemplazables de contenedores.

Ansible prepara sistema y despliegue; Compose ejecuta los servicios. Fijar versiones e imágenes verificadas. Crear imágenes fuera de los VPS de 4 GB. El panel de administración no es un servicio obligatorio adicional.

## Actualizaciones graduales

Primero validar contrato y migraciones en CI; luego staging, portal compatible hacia atrás y un CRM piloto. Observar errores y colas, continuar con dos CRM y finalmente los cinco restantes. Permitir que las ocho instancias convivan con versiones compatibles distintas.

Migraciones de base separadas del arranque web, ejecutadas una sola vez por instalación. Preferir agregar, migrar y retirar en etapas. Rollback de código no revierte datos; documentar compatibilidad y restauración antes de cambios destructivos.

El pipeline no debe tener una credencial capaz de administrar las nueve cuentas si no es necesario. Cada despliegue necesita su autorización técnica y secreto de alcance acotado; controles de acceso humano fuera del código.

## Respaldos

Propuesta: cada CRM con exportación PostgreSQL cada 6 horas; portal cada hora para reducir pérdida de consultas no entregadas; archivos diarios y antes de cambios importantes. Usar dumps consistentes y snapshot o manifiesto coherente de archivos. No copiar archivos internos de PostgreSQL mientras está activo como si fuera una copia válida.

Restic envía copias cifradas fuera de los VPS, con repositorio y claves separados por instancia. La clave de recuperación se custodia fuera del servidor. Evitar que una credencial de un CRM pueda borrar o leer los respaldos de otro. Los snapshots semanales del hosting son complementarios.

Objetivos propuestos: RPO de 6 horas para CRM y 1 hora para consultas pendientes del portal; RTO de 4 horas por instancia. Dependen de ejecución y restauración verificadas, no son SLA del proveedor. Ajustar antes de producción si el negocio necesita menor pérdida.

Retener los puntos horarios del portal durante 48 horas y los de 6 horas de CRM durante 7 días; además 14 diarios y 3 mensuales, sujeto a presupuesto y política de datos. Probar restauración mensual rotando instancias; todas deben tener una restauración probada antes del alta real.

Una restauración no debe reactivar publicaciones retiradas ni mensajes eliminados. Aplicar el procedimiento del [protocolo](03-contrato-y-sincronizacion.md) antes de reconectar un CRM restaurado.

## Monitoreo y costos

Medir disponibilidad web, CPU, RAM, disco, conexiones, edad de outbox, consultas sin entregar, errores por agencia y antigüedad del backup. Alertar si una cola tarda más de 15 minutos o un respaldo pierde su ventana. No interpretar HTTP 200 como prueba suficiente de sincronización.

Kuma puede operar fuera del servidor que vigila o cubrirse con comprobaciones cruzadas y una alerta externa. Instalar el único monitor en el portal dejaría sin alerta la caída de ese mismo VPS; documentar esa limitación si se elige por costo.

Asignar responsable, suplente y canal de incidentes. Registrar tiempo de soporte para comprobar si la separación resulta sostenible. El costo de mantener nueve servidores puede superar sus licencias y alojamiento.

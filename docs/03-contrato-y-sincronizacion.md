# Contrato y sincronización entre productos

## Protocolo LAB v1

HTTPS y JSON, documentados en [OpenAPI](../contracts/openapi.json). Es un borrador implementable, no una API desplegada. Los endpoints de integración se sirven en PORTAL-LAB y son invocados por CRM-LAB. La API pública del buscador, las sesiones y la API privada del CRM son contratos distintos, fuera de este archivo inicial.

PORTAL-LAB se adapta al DTO público de CRM-LAB. No importa clases internas, no consulta tablas remotas y no depende de la versión exacta de su interfaz. El contrato tiene versión independiente de ambos productos. Mantener compatibilidad con la versión menor anterior; un cambio incompatible requiere `/v2` y una ventana de migración de al menos 90 días acordada con las ocho inmobiliarias.

## Identidad y permisos

El operador registra manualmente ocho conexiones. Cada una recibe `agency_id` y un token aleatorio exclusivo de integración de al menos 256 bits. El portal guarda su hash, estado y permisos; el CRM guarda el secreto fuera del código. HTTPS es obligatorio. El token solo permite publicar, subir fotos públicas y recoger o confirmar consultas de su conexión.

Nunca aceptar el tenant destino como dato confiable de una petición. Resolver `agency_id` desde el token. Validar la pertenencia de IDs de medios, publicaciones y consultas. Tokens de A no leen ni modifican recursos de B, aunque conozcan el UUID. Separar credenciales de integración de las sesiones del administrador y de la infraestructura.

Rotar tokens con un período breve de solapamiento; revocar inmediatamente al desvincular la cuenta. No utilizar una única clave maestra en los ocho CRM. Limitar frecuencia y tamaño por conexión; devolver `429` y respetar `Retry-After`.

## Publicación y fotos

1. Una transacción local guarda la oferta y un trabajo en la outbox del CRM.
2. El trabajador genera derivados de fotos aprobadas, sin EXIF, y los envía a `/v1/media` con clave idempotente.
3. El portal limita tamaño y dimensiones, verifica y recodifica la imagen; devuelve `media_id` propio de esa conexión. No descarga URLs arbitrarias proporcionadas por el CRM.
4. CRM envía `PUT /v1/listings/{source_listing_id}` con revisión entera creciente y ficha pública completa. Una activación requiere todos sus medios presentes y listos.
5. El portal valida y guarda la proyección en una transacción; responde con revisión aceptada. El CRM marca sincronizado solo después.

Cada `source_listing_id` representa una oferta de un inmueble. Precios como cadena decimal, moneda ISO explícita, áreas en m², ubicación pública y contacto comercial registrado de la agencia. No enviar propietario, notas ni ubicación exacta si se optó por aproximarla. La publicación usa texto plano y medios aprobados; rechazar HTML ejecutable.

Revisión igual y contenido igual: éxito idempotente. Revisión menor, o revisión igual con contenido distinto: `409`. Revisión superior: reemplazo de la proyección. Registrar también la revisión de fichas retiradas para impedir que un mensaje viejo las reactive.

La baja se envía con el mismo PUT, `status=withdrawn`, revisión superior y sin ficha. Ocultar ficha, listado y sitemap inmediatamente; invalidar cachés. Los medios solo son servibles si alguna publicación activa autorizada los referencia. Retirar huérfanos después de la retención operativa; una foto descargada previamente por un visitante no puede recuperarse.

## Entrega de consultas

El formulario público envía el identificador de la ficha. PORTAL-LAB comprueba que está activa y resuelve su inmobiliaria; el navegador no decide el destino. Guardar mensaje e identificador estable antes de mostrar éxito. Implementar rate limiting y controles antispam. El correo es una notificación auxiliar, nunca la única copia.

Cada CRM consulta `/v1/inquiries` cada 60 segundos, con variación aleatoria para evitar sincronizar los ocho relojes. Paginar con cursor y máximo 100 registros. Al terminar una recorrida, comenzar de nuevo sin cursor: un cursor de entrega no es una confirmación y no debe saltarse consultas pendientes fallidas. El portal puede reentregar.

El CRM inserta la consulta y su relación comercial en una transacción con restricción única `(portal_instance_id, inquiry_id)`. Solo después llama `/v1/inquiries/{inquiry_id}/ack` con el identificador local. Una confirmación repetida coherente es exitosa; una identidad local contradictoria requiere investigación. La garantía es entrega al menos una vez con deduplicación, no transporte exactamente una vez.

No convertir cada mensaje en oportunidad nueva ni fusionar personas por nombre. La atribución y el vínculo a la oferta se conservan. Un interesado puede tener oportunidades diferentes.

## Reintentos y reconciliación

Persistir intentos, error resumido y próximo intento. Espera creciente con variación, de segundos hasta 15 minutos; alertar trabajos detenidos. Para errores permanentes de validación, pedir corrección; no reintentar indefinidamente un payload inválido.

Cada 15 minutos, el CRM obtiene el índice de sus publicaciones con `/v1/listings`, compara IDs, estados y revisiones, corrige diferencias y envía un manifiesto de todas sus fichas activas a `/v1/reconcile`. Para el MVP admitir hasta 1.000 publicaciones activas por instancia. El portal renueva por 72 horas la vigencia solo cuando ese conjunto coincide; si difiere, devuelve los IDs en conflicto y no renueva. Ejecutar además una auditoría completa diaria, incluyendo medios.

Una ficha que falta del manifiesto no se borra automáticamente: el CRM debe confirmar su baja con una revisión superior. Una inmobiliaria suspendida no puede renovar vigencia. El operador puede retirar fichas y suspender una conexión independientemente de los permisos locales del CRM.

## Restauración

Antes de reanudar un CRM restaurado, detener sus envíos, consultar el índice remoto y comparar revisiones. No sobrescribir contenido remoto más reciente con datos de una copia antigua. Recuperar las ediciones faltantes o resolverlas con el agente, y asignar a la próxima edición una revisión superior al máximo conocido. Conservar IDs estables y no volver a empezar contadores en cero.

El portal permite consultar también entregas confirmadas mediante `include_delivered=true` durante su ventana de retención, para recuperar un CRM restaurado. La deduplicación local hace segura esa repetición. Copias anteriores a la ventana pueden requerir recuperar datos de backups adicionales; declarar la pérdida potencial.

Si se restaura el portal, los CRM vuelven a comparar su estado y reconstruyen el catálogo. Las consultas recibidas después de la última copia del portal pueden perderse si nunca llegaron al CRM; por eso el portal necesita respaldos más frecuentes que una copia semanal del proveedor.

## Retención y objetivos propuestos

- Consultas pendientes: hasta 30 días, con alertas tempranas y procedimiento de recuperación antes del vencimiento. No borrarlas en silencio.
- Consultas confirmadas: conservar el contenido 7 días para recuperación y luego quitar datos personales del portal. Registrar identificadores y estado mínimo según política acordada.
- Registro de revisiones de publicaciones: conservar la revisión y estado aunque se purgue el contenido; no reutilizar IDs.
- Consultas al CRM y publicación: objetivo menor a dos minutos con servidores operativos, por comprobar.
- La política de retención debe informarse y coordinarse con copias y eliminación de datos. Los respaldos tienen su propia caducidad.

## Pruebas de compatibilidad obligatorias

Token A contra recursos B; evento repetido; revisión fuera de orden; bajas; credencial vencida; payload privado inesperado; foto ajena; 429; caída del portal; CRM desconectado; consulta guardada con ACK perdido; restauración antigua; paginación completa; expiración de catálogo; versión de contrato no soportada.

Los productores emiten solo campos definidos. Los clientes deben ignorar campos adicionales en respuestas; las entradas al portal se restringen al esquema negociado. Agregar campos de petición requiere declarar la versión compatible antes de utilizarlos. Un campo desconocido nunca se copia directamente a la vista pública. Los ejemplos y esquemas compartidos se prueban contra ambos productos en CI.

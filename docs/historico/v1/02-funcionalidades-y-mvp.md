> HISTÓRICO — Diseño v1 sustituido el 9 de octubre de 2026. Consultar el README de la raíz para la arquitectura vigente de ocho CRM independientes y un portal.

# Funcionalidades y alcance del MVP

## Referencia funcional

La documentación pública de Tokko se usa para identificar familias de funciones. La columna de implementación es una propuesta para este proyecto, no una promesa de equivalencia. Las características disponibles pueden variar por país, plan e integración.

| Familia de funciones en Tokko | Implementación propuesta | Etapa |
| --- | --- | --- |
| Contactos y oportunidades | Contactos, consultas, responsable y seguimiento por etapas | MVP |
| Seguimiento y recordatorios | Actividades, próximas acciones y visitas | MVP |
| Propiedades y desarrollos | Ficha de inmueble, fotos y operaciones; desarrollos con unidades después | MVP / posterior |
| Sitio web y buscadores | Portal compartido, páginas de inmobiliaria, filtros y ficha pública | MVP |
| Difusión a canales | Publicación en el portal propio; conectores externos por separado | MVP / posterior |
| Colaboración y permisos | Usuarios, roles, sucursales simples y auditoría | MVP |
| Reportes | Consultas, tiempos de atención y oportunidades por etapa | MVP |
| Red de colaboración | Compartir fichas mediante acuerdos explícitos | Posterior |
| Acceso móvil | Interfaz web adaptable; evaluar app nativa según uso | MVP / posterior |
| API e integraciones | Contratos internos estables; importador autorizado opcional | Posterior |

Fuentes: [funciones de Tokko](https://blog.tokkobroker.com/7-funcionalidades-de-tokko-broker), [sitio oficial](https://www.tokkobroker.com/es-ar/), [centro de ayuda](https://dudas.tokkobroker.com/es) y [API de contactos](https://developers.tokkobroker.com/docs/contactos).

La promoción general menciona acceso móvil, pero el centro de ayuda contiene una restricción territorial en su sección de aplicación. Por eso no se toma su disponibilidad en Argentina como requisito verificado. La web móvil propuesta es una decisión propia.

## Historias prioritarias y aceptación

| ID | Necesidad | Evidencia de aceptación |
| --- | --- | --- |
| M01 | El administrador crea una inmobiliaria e invita usuarios | Invitación con vencimiento; alta sin acceso a otra organización |
| M02 | El agente registra una propiedad | Tipo, ubicación, superficies, ambientes, estado y código interno; validación de unidades |
| M03 | El agente ofrece venta o alquiler | Operaciones separadas, precio decimal, moneda, periodicidad y expensas sin mezclar monedas |
| M04 | El editor administra fotografías | Orden, portada, texto alternativo, límites y eliminación controlada |
| M05 | La inmobiliaria decide qué publicar | Borrador, publicado y retirado; versión pública sin propietario ni notas privadas |
| M06 | El visitante busca propiedades | Filtros por operación, zona, tipo, moneda y rango; paginación; interfaz móvil |
| M07 | El visitante consulta una ficha | Consulta vinculada a publicación, inmobiliaria y origen; protección contra abuso |
| M08 | El agente sigue la oportunidad | Contacto, responsable, historial y etapa; la misma persona puede tener varias oportunidades |
| M09 | El agente organiza su trabajo | Actividad con fecha, estado y responsable; visitas mostradas en hora local |
| M10 | La gerencia consulta indicadores | Totales y tiempos calculados exclusivamente sobre su organización |
| M11 | La inmobiliaria exporta sus datos | CSV autorizado con campos seleccionados y auditoría; exportación de archivos por proceso controlado |
| M12 | El administrador recupera la operación | Copia restaurada en entorno aislado y procedimiento registrado |

La primera publicación incluye filtros, galería, descripción, precio y moneda, contacto de la inmobiliaria y ubicación pública aproximada. El mapa interactivo puede esperar; si se incorpora, elegir proveedor y presupuesto para mapas y geocodificación.

Una consulta queda guardada aunque falle la notificación por correo. El tablero debe mostrarla de inmediato. El responsable inicial puede asignarse manualmente; las reglas automáticas de reparto se agregan cuando haya un criterio de negocio confirmado.

## Flujo de demostración

1. Crear inmobiliarias ficticias A y B y un usuario agente para cada una.
2. En A, cargar una propiedad con una oferta de venta y tres fotografías de prueba.
3. Publicarla y verificar que aparece en el portal general y en la página de A.
4. Enviar una consulta como visitante y comprobar su ingreso al CRM de A.
5. Asignar responsable, programar visita y cambiar la etapa.
6. Ingresar como B e intentar consultar, editar y exportar ese registro por su identificador: debe rechazarse.
7. Retirar la publicación y verificar que desaparece del buscador y de la ficha pública según la política de bajas.

## Prioridad posterior

Después del piloto: matching entre búsquedas e inmuebles mediante reglas, emprendimientos y unidades, reportes más amplios, integración de calendario, dominios propios, cargas masivas y un primer conector externo. Más adelante: red entre inmobiliarias, facturación del servicio, búsqueda semántica y automatizaciones de IA evaluadas.

WhatsApp mediante un enlace de contacto no equivale a recibir conversaciones dentro del CRM. Para una integración real se necesita un proveedor y un diseño de entrada, identidad, consentimiento, estados y costos. La primera versión puede registrar manualmente la interacción.

## Integraciones y eventual migración desde Tokko

La API documenta consulta de propiedades e ingreso de consultas con clave. Esa capacidad no demuestra acceso a todo el historial, a adjuntos privados ni a todos los endpoints necesarios para una migración completa. [Documentación de contactos](https://developers.tokkobroker.com/docs/contactos).

Si una inmobiliaria ya utiliza Tokko, hacer primero una prueba autorizada de lectura con pocos registros. Definir un sistema maestro por entidad y mantener la importación unidireccional en el piloto. Conservar `external_id`, origen y fecha de actualización; paginar, registrar errores y conciliar cantidad de registros. La documentación incluye límites por solicitud, por lo que no corresponde descargar todo en una sola petición. [Guía API](https://developers.tokkobroker.com/docs/pegadas-utiles-a-la-api).

Para cada portal externo, crear una ficha de integración: autorización comercial, credenciales por inmobiliaria, operaciones disponibles, campos obligatorios, límites, ambiente de prueba, reintentos, bajas y conciliación. Hasta verificar esa ficha, el conector permanece fuera del compromiso del MVP. El portal propio puede operar sin esos acuerdos.

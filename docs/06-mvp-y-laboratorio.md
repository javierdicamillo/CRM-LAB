# Alcance del MVP y plan de laboratorio

## Funciones mínimas

| ID | Producto | Entrega y aceptación |
| --- | --- | --- |
| CRM01 | CRM | Usuarios y roles locales; un agente no administra usuarios |
| CRM02 | CRM | Propiedades, ofertas, moneda, fotos y datos privados |
| CRM03 | CRM | Publicar o retirar con estado de sincronización visible |
| CRM04 | CRM | Contactos, oportunidades y actividades con responsable |
| CRM05 | CRM | Importar consulta repetida sin duplicar seguimiento |
| CRM06 | CRM | Exportar y restaurar datos propios |
| POR01 | Portal | Filtros, ficha, galería y página de inmobiliaria |
| POR02 | Portal | Recibir consultas aun con CRM destino temporalmente caído |
| POR03 | Portal | Conexiones por agencia; token A no accede a B |
| POR04 | Portal | Catálogo local, retiro inmediato y vencimiento controlado |
| INT01 | Ambos | Contrato versionado y pruebas entre versiones compatibles |
| INT02 | Ambos | Reintentos, revisión, paginación y reconciliación |
| OPS01 | Ambos | Nueve instalaciones reproducibles y copias verificadas |

Referencia funcional: Tokko ofrece gestión comercial, propiedades, difusión y sitios web. Se mantienen esas familias como guía del producto; no se implementa su red ni se copia software propietario. [Tokko](https://www.tokkobroker.com/es-ar/).

Fuera del MVP: sincronización completa con todos los canales y portales comerciales, cobro de suscripciones, app nativa, contabilidad, SSO global y automatizaciones de IA. Los conectores entrarán por valor real y presupuesto de cada inmobiliaria.

## Fases

Estimación propia: 14–20 semanas, dos desarrolladores de 25 horas semanales, referente inmobiliario y revisión de calidad. Equivale a 700–1.000 horas de desarrollo; producto, operación y revisión se presupuestan además. Un equipo principiante con menor dedicación necesitará otro calendario. Sustituye la estimación v1.

| Fase | Ventana | Evidencia |
| --- | --- | --- |
| Contrato y prototipo | Semanas 1–2 | Dos CRM ficticios y un portal; publicación y consulta |
| Núcleo CRM | 3–6 | Inventario, usuarios, roles y seguimiento |
| Portal y sincronización | 7–10 | Búsqueda, fotos, revisiones, bajas y entrega |
| Operación y fallas | 11–13 | Restauración, seguridad, cargas y compatibilidad |
| Piloto y despliegue gradual | 14–20 | Primero 1, luego 2 y finalmente 8 inmobiliarias |

## Criterios para ampliar a ocho

Publicar dos ofertas de agencias diferentes, verificar fotos copiadas, enviar consultas y confirmar destino. Desconectar un CRM: el portal sigue atendiendo y retiene consultas. Reconectar: las entrega una sola vez en el registro local, aunque el transporte las repita. Restaurar una copia antigua y reconciliar sin reactivar bajas ni perder consultas dentro de la ventana de recuperación.

Probar tokens cruzados, índices y exportaciones, medios ajenos, revisión fuera de orden, actualización concurrente, API desconocida, paginación, cuotas y expiración. Evaluar también versión anterior del CRM contra portal actualizado.

Carga inicial propuesta: 4.000 inmuebles, hasta 1.000 publicaciones activas por instancia, fotos derivadas y 20 usuarios virtuales en el portal. Objetivo inicial de p95 menor a 800 ms para búsquedas y lecturas JSON, excluyendo imágenes, y menos de 1% de errores. Medir consumo con cargas de edición en cada CRM. Son objetivos de prueba, no resultados obtenidos.

No ampliar hasta probar restauración y asignar responsable por servidor. No comprar ocho máquinas desde el primer día de programación: el presupuesto contempla ocho CRM, la incorporación es gradual.

## Exposición de 8 minutos

| Tiempo | Tema |
| --- | --- |
| 0–1 | Cambio de requisito: independencia por inmobiliaria |
| 1–2 | Nueve servidores y propiedad de datos |
| 2–3 | Publicaciones públicas frente a información privada |
| 3–4 | Contrato OpenAPI y versiones independientes |
| 4–5 | Consulta, entrega y deduplicación |
| 5–6 | Demostración de una caída y recuperación |
| 6–7 | Costos iniciales, renovación y operación |
| 7–8 | Papel de IA, evidencia y próximos pasos |

La IA puede ayudar a revisar esquemas, generar fixtures ficticios, proponer casos de fallo y documentar PR. Medir tiempo hasta aprobación, errores y retrabajo. Registrar propuesta, corrección humana y prueba; no afirmar ahorro causal por una sola tarea.

Estado al 9/10/2026: CRM-LAB 0.1.0 desplegado en el primer VPS. CRM01–CRM05 implementados y probados en entorno aislado; CRM06 tiene exportaciones y restauración operativa de una copia completa de la instalación vacía. El conector INT02 pasó pruebas con un portal simulado. POR01–POR04, INT01 contra dos productos reales y OPS01 para nueve servidores siguen pendientes. La [entrega del piloto](09-entrega-crm-mvp.md) distingue evidencias, límites y pasos de demostración.

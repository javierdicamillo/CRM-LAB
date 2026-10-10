> HISTÓRICO — Diseño v1 sustituido el 9 de octubre de 2026. Consultar el README de la raíz para la arquitectura vigente de ocho CRM independientes y un portal.

# Plan de trabajo y exposición en el laboratorio de IA

## Calendario de referencia

Estimación propia de planificación, sin cotización ni equipo confirmado: dos desarrolladores con 25 horas semanales cada uno, referente inmobiliario disponible y revisión de calidad. El horizonte de 12–16 semanas equivale a 600–800 horas de desarrollo; las últimas semanas incluyen estabilización y margen de incertidumbre. La participación de producto, soporte y revisión debe presupuestarse además.

| Fase | Semanas | Entrega | Condición de avance |
| --- | --- | --- | --- |
| Validación técnica y de negocio | 1 | Hosting probado, dos tenants y recorrido acordado | Conectividad y aislamiento demostrados |
| Identidad y datos | 2–3 | Organizaciones, usuarios, roles y migraciones | Pruebas de permisos y revocación |
| Inventario y portal | 4–6 | Propiedades, fotos, publicación y buscador | Publicar y retirar sin filtrar datos privados |
| Gestión comercial | 7–9 | Consultas, contactos, oportunidades y actividades | Circuito completo con datos ficticios |
| Operación | 10–11 | Exportaciones, indicadores, monitoreo y recuperación | Restauración y pruebas de fallos |
| Piloto y estabilización | 12–16 | Uso supervisado por 1–3 inmobiliarias antes de ampliar | Errores críticos resueltos y aceptación del negocio |

Si se trabaja en modo taller con principiantes y pocas horas semanales, usar inicialmente un horizonte de 6–9 meses y revisar la previsión después de dos iteraciones. El calendario no incluye conectores comerciales ni migración masiva desde otros CRM. No descontar tiempo por usar IA sin medir cuánto se ahorra y cuánto se retrabaja.

## Prueba técnica inicial de 3 a 5 jornadas

El resultado debe poder revisarse como evidencia, no solo como una captura de una pantalla funcionando.

1. Confirmar plan de Hostinger, responsable y presupuesto; desplegar una aplicación mínima desde un commit identificado.
2. Conectar la base y guardar una propiedad ficticia en A y otra en B.
3. Validar sesión, membresía y RLS con intentos cruzados de lectura y escritura.
4. Publicar una proyección limitada y guardar una consulta en el tenant correcto.
5. Probar persistencia de archivos, un trabajo reintentable y recuperación; registrar limitaciones.

Avanzar con Node.js administrado si los controles pasan y hay una solución viable para tareas. Elegir VPS si se necesita instalar base y procesos propios, o si la prueba administrada falla en una condición necesaria. Mantener la demostración local si aún no hay responsable de operar el servicio.

## Dimensionamiento y riesgos

Hipótesis de almacenamiento: 5.000 propiedades × 12 fotografías × 300 KB por derivado optimizado ≈ 18 GB. Con originales de 2 MB, se agregan aproximadamente 120 GB. No incluye versiones, miniaturas adicionales ni respaldos. Este cálculo explica por qué las imágenes no deben versionarse en GitHub y por qué se debe presupuestar transferencia y retención.

La cantidad de usuarios registrados no indica concurrencia. Para una primera prueba de carga se propone un conjunto sintético de 5.000 propiedades y 20 usuarios virtuales, con mezcla de búsquedas, lectura de fichas y consultas. Objetivos iniciales a validar: errores inferiores al 1% y percentil 95 de consultas comunes por debajo de 800 ms, excluyendo transferencia de imágenes. Registrar máquina, región, datos y duración para poder comparar.

| Riesgo | Tratamiento | Responsable propuesto |
| --- | --- | --- |
| Filtración entre inmobiliarias | Pruebas negativas, RLS, claves compuestas y revisión | Desarrollo y revisión técnica |
| Alcance similar a toda la plataforma Tokko | MVP cerrado y backlog separado | Producto |
| Restricciones del hosting | Prueba temprana y alternativa VPS | Operación |
| Acceso no disponible a portales | Un conector por vez, tras verificar condiciones | Producto e integraciones |
| Costos de medios y transferencia | Cuotas, derivados, retención y medición | Operación |
| Código incorrecto sugerido por IA | Revisión humana y evidencia automatizada | Autor y revisor del PR |
| Portal sin consultas | Validar difusión y uso con inmobiliarias reales | Referente comercial |

## IA para construir el producto

El laboratorio puede usar IA para convertir requisitos en historias, comparar diseños, proponer código, generar datos ficticios y buscar casos de prueba. El equipo conserva la responsabilidad de revisar fuentes, licencias, cambios y resultados. No pegar datos reales de clientes en herramientas externas durante los ejercicios.

Cada experiencia debe conservar: objetivo, entrada anonimizada, herramienta y modelo declarados, fecha, propuesta obtenida, corrección humana, pruebas, tiempo empleado y conclusión. Guardar solo lo necesario para reproducir el aprendizaje, sin credenciales ni información privada.

Ejemplos de consignas:

- “A partir de esta historia, enumera casos de aceptación y accesos que deben rechazarse. Separa supuestos de requisitos.”
- “Revisa esta consulta para detectar accesos entre organizaciones. Explica cómo demostrarías el fallo con dos tenants ficticios.”
- “Propón una descripción comercial usando exclusivamente estos campos. Si falta un dato, no lo inventes.”

## IA dentro del producto

Se propone después del núcleo operativo. Primer experimento: borradores de descripción a partir de campos de una propiedad. El usuario revisa antes de publicar. Segundo: resumen de interacciones autorizadas dentro del mismo tenant. Tercero: sugerencias de inmuebles para una búsqueda, comparadas contra una solución por reglas.

La IA no decide permisos, no establece precios automáticamente y no ejecuta instrucciones contenidas en mensajes de clientes. El servidor selecciona la información autorizada antes de enviarla al modelo. Registrar costos por tenant y permitir desactivar la función sin impedir el uso del CRM.

Evaluación sugerida: 30 fichas ficticias con distintos niveles de información; medir tiempo de edición, porcentaje de textos aceptados, errores de precio o características y costo por borrador. Criterio propuesto: cero hechos inventados en el conjunto de aceptación y aprobación humana obligatoria. Superar esa muestra no demuestra ausencia de errores futuros.

## Cómo medir el proceso del laboratorio

Comparar tareas de dificultad semejante con y sin ayuda, registrando tiempo completo hasta aprobación, defectos encontrados y correcciones necesarias. No atribuir causalmente una mejora a IA a partir de una sola tarea. Repetir, conservar condiciones y declarar las limitaciones de la muestra.

En el piloto de negocio, medir consultas válidas por origen, tiempo hasta primera respuesta humana, oportunidades con próxima acción y avance a visita. Definir los eventos antes de medir: abrir una ficha o enviar un correo automático no cuenta como respuesta humana. Mantener denominadores y períodos visibles, sin juntar monedas en valores comerciales.

## Guion para una exposición de 8 minutos

| Tiempo | Mensaje | Material |
| --- | --- | --- |
| 0:00–1:00 | Problema: inventario, publicación y seguimiento dispersos | Una historia de una consulta perdida |
| 1:00–2:00 | Referencia: familias de funciones de Tokko | Matriz de alcance |
| 2:00–3:00 | Multicliente: varias inmobiliarias con datos privados separados | Ejemplo A y B |
| 3:00–4:00 | Stack y alternativas Hostinger | Diagrama y decisión condicionada |
| 4:00–5:00 | Primer circuito que se construirá | Carga → publicación → consulta → visita |
| 5:00–6:00 | Trabajo colaborativo | Tarea → rama → PR → prueba → revisión |
| 6:00–7:00 | Aporte de IA con evidencia | Una propuesta, una corrección y una prueba |
| 7:00–8:00 | Próximo hito y responsables | Prueba técnica de 3–5 jornadas |

En esta etapa se presenta una evaluación, no una demo operativa. Cuando exista el prototipo, sustituir la explicación del circuito por la demostración de A y B. Si falla, mostrar el error y su registro de aprendizaje sin presentarlo como un resultado exitoso.

## Plantilla de bitácora

```text
Fecha y tarea:
Objetivo y criterio de aceptación:
Fuentes y supuestos:
Herramienta de IA y modelo:
Entrada sin datos sensibles:
Propuesta de IA:
Cambios hechos por la persona:
Prueba ejecutada y resultado:
Tiempo total y retrabajo:
Decisión y siguiente experimento:
Enlace a commit o pull request:
```

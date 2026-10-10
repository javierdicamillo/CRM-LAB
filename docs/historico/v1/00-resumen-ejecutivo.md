> HISTÓRICO — Diseño v1 sustituido el 9 de octubre de 2026. Consultar el README de la raíz para la arquitectura vigente de ocho CRM independientes y un portal.

# Propuesta resumida para el laboratorio de IA

8 de octubre de 2026 · Etapa de evaluación · Lectura de 3 minutos

**Es factible construir un CRM y un portal inmobiliario en una sola aplicación multicliente y de código abierto.** La primera versión debe demostrar un circuito completo: cargar una propiedad, publicarla, recibir una consulta y gestionarla hasta una visita o cierre.

## El problema y la referencia

Una inmobiliaria necesita mantener su inventario y atender interesados sin duplicar información entre sistemas. Varias inmobiliarias pueden compartir la misma plataforma, conservando separados sus contactos y su gestión interna.

Tokko Broker integra propiedades, oportunidades comerciales, difusión y sitios web. Lo usamos como referencia de producto, sin asumir que podremos reproducir en el piloto todos sus acuerdos con portales. [Referencia oficial](https://www.tokkobroker.com/es-ar/).

## La solución propuesta

| Decisión | Propuesta |
| --- | --- |
| Producto | CRM privado y portal público sobre el mismo inventario |
| Multicliente | Una organización por inmobiliaria; varios usuarios y roles dentro de cada una |
| Tecnología | Next.js + TypeScript + Node.js 24 LTS + PostgreSQL |
| Desarrollo | Un repositorio GitHub, tareas pequeñas, revisión por otra persona y pruebas automáticas |
| Código abierto | Recomendar AGPL-3.0 para el código propio; resolver su adopción antes de publicar |
| IA inicial | Ayudar a investigar, documentar, programar y probar; revisión humana de cada entrega |

## Qué entra primero

Acceso por inmobiliaria, propiedades y fotografías, buscador público, formulario de consulta, contactos, seguimiento por etapas, agenda básica e indicadores. La web se adapta al celular. Las integraciones con portales comerciales, la mensajería automática y las funciones avanzadas de IA se incorporan después.

Un dato público es la ficha autorizada para difusión. Los datos del propietario, las notas y las negociaciones permanecen privados. Compartir plataforma no significa compartir toda la información.

## Dónde alojarlo

Hostinger ofrece Node.js administrado en Business y Cloud. Puede ser la primera opción si se verifica una conexión segura a PostgreSQL externo. Si se requiere alojar también PostgreSQL y procesos de fondo dentro de Hostinger, se propone un VPS. [Node.js](https://www.hostinger.com/support/node-js-hosting-options-at-hostinger/) · [Bases de datos](https://www.hostinger.com/support/which-databases-and-data-tools-are-supported-at-hostinger/).

## Esfuerzo y condición de avance

Hipótesis: 12–16 semanas con dos desarrolladores que aporten 25 horas semanales cada uno, más participación de una persona del negocio y revisión de calidad. Un equipo principiante con menor dedicación debe planificar varios meses adicionales. No hay todavía una cotización ni una prueba de rendimiento.

El primer hito consiste en publicar una propiedad ficticia de la inmobiliaria A, recibir una consulta y comprobar que un usuario de B no puede acceder a ella. También se debe restaurar una copia de seguridad antes del piloto real.

## Cómo mostrar el aporte de IA

Conservar una cadena de evidencia: pedido → fuentes → decisiones → tarea GitHub → propuesta de IA → corrección humana → prueba → demostración. Medir tiempo total, errores y retrabajo; el volumen de código generado no demuestra calidad.

**Resultado de esta etapa:** propuesta documentada, alcance inicial y plan de validación. **Resultado esperado de la próxima:** demostración técnica con dos inmobiliarias ficticias.

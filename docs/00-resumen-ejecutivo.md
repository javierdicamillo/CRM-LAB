# Ocho CRM-LAB independientes y un PORTAL-LAB común

Diseño v2 del 9 de octubre de 2026. Ocho inmobiliarias y ocho VPS nuevos para sus CRM, más un noveno VPS para el portal.

Cada inmobiliaria mantiene sus propiedades, contactos y gestión en **CRM-LAB**. **PORTAL-LAB** reúne las fichas autorizadas y devuelve consultas al CRM correspondiente.

## Cómo funciona

El agente carga y publica una oferta. CRM-LAB envía la ficha y fotos optimizadas. El portal guarda esa copia y la muestra. Un visitante consulta; el portal guarda el mensaje y el CRM lo recoge, confirma y convierte en seguimiento comercial.

La caída temporal de un CRM no detiene el buscador. La caída del portal no bloquea la gestión privada. Separar servidores reduce el alcance de una falla, pero requiere sincronización y operación coordinada.

## Herramientas

Next.js, TypeScript y PostgreSQL para ambos productos; Caddy para HTTPS, Docker Compose para desplegar, restic para copias y OpenAPI para compatibilidad. Un monorepo GitHub con entregas independientes evita duplicar ocho veces el mantenimiento del CRM.

El MVP evita Redis, buscadores externos, ocho Chatwoot, Kubernetes e IA paga obligatoria. Los canales se incorporan por inmobiliaria y según uso.

## Alcance y costo

Primero: inventario, publicar y retirar, filtros, consultas, oportunidades, tareas, permisos y recuperación. Se conserva Tokko como referencia funcional, sin prometer todas sus integraciones.

Los nueve servidores equivalen aproximadamente a USD 61 mensuales promocionales y USD 111 a los precios de renovación consultados. Se suman respaldo, dominio, correo y operación. La oferta exige pago anticipado; confirmar plazo, impuestos y región antes de comprar. [Hostinger](https://www.hostinger.com/vps-hosting). Ver [presupuesto](04-costos.md).

Estimación propia: 14–20 semanas con dos desarrolladores de 25 horas semanales, más producto y revisión. La implementación de todos los canales no está incluida.

## Evidencia para el laboratorio

Demostrar dos CRM ficticios, un portal, una consulta entregada sin duplicarse y recuperación tras una caída. Conservar requisito, contrato, cambio de código, revisión humana y prueba. La IA ayuda a proponer y comprobar; los resultados deben ser verificables.

Estado: estructura y contrato preliminar. Aplicaciones y despliegues pendientes.

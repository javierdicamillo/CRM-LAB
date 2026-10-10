# Contrato de compatibilidad LAB

El [OpenAPI preliminar](openapi.json) define la integración de CRM-LAB con PORTAL-LAB. Estado `1.0.0-draft.1`: se entrega para revisión e implementación; no hay servidor funcional en la URL de ejemplo.

## Alcance

PORTAL-LAB sirve los endpoints y cada CRM inicia conexiones HTTPS con un token exclusivo. El portal determina la agencia a partir de ese token. Se incluyen capacidades, índice propio, publicación y retiro, subida de fotos, entrega y confirmación de consultas y reconciliación.

Las APIs internas de CRM, búsqueda pública, formulario público y administración de conexiones se implementarán aparte. El contrato no es una aplicación ni automatiza la contratación de servicios.

## Ejemplos ficticios

- [Publicar](examples/published.json): primero subir el medio y reemplazar su ID por el recibido.
- [Retirar](examples/withdrawn.json): mismo ID de publicación, revisión superior.
- [Consulta](examples/inquiry.json): evento entregado por el portal, sin datos reales.

No usar IDs de ejemplo como IDs productivos. El esquema de precios del borrador requiere importe y moneda; publicar precios a consultar queda como ampliación acordada del contrato, no como campo implícito.

## Validación

Validar la estructura OpenAPI con una herramienta compatible con 3.1, resolver referencias internas y validar ejemplos contra sus esquemas. Al implementar, sumar pruebas de contrato que ejecuten los endpoints reales de ambos productos y una versión anterior compatible de CRM-LAB.

No confundir una validación de especificación con pruebas de autorización, disponibilidad o integridad de datos. El protocolo completo, incluidas deduplicación, restauración y retención, está en [sincronización](../docs/03-contrato-y-sincronizacion.md).

## Comprobaciones realizadas el 9 de octubre de 2026

OpenAPI validado con Redocly CLI y reglas minimal. Los tres ejemplos fueron validados con AJV contra los esquemas correspondientes y formatos JSON Schema 2020-12. Ambos procesos terminaron correctamente. No se probaron endpoints reales porque todavía no hay implementación.

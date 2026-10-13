# Contrato de compatibilidad LAB

[OpenAPI 1.1.0](openapi.json), implementado por PORTAL-LAB. El CRM inicia las conexiones HTTPS; el token determina la inmobiliaria. La URL de ejemplo sigue siendo un marcador hasta definir el despliegue.

Endpoints: capacidades, índice paginado con bajas, publicación/retiro, subida de medios, entrega y ACK de consultas y reconciliación exacta. La versión 1.1 agrega `listing.cadastre`, opcional, con provincia `AR-Q` y nomenclatura de parcela de 15 dígitos. El portal acepta clientes 1.0 que omiten ese campo; el CRM solo lo envía si el destino anuncia 1.1. El resto del contrato se conserva.

La referencia solo se envía con autorización expresa de publicar la nomenclatura y ubicación exacta. Las geometrías y fechas se obtienen del servicio público DPCeIT, no del cuerpo enviado por una agencia. Adaptador: [cadastre.ts](cadastre.ts). No acredita titularidad ni identifica unidades funcionales.

Los ejemplos de `examples/` son ficticios. Las pruebas de PORTAL-LAB ejecutan los handlers y validan respuestas contra OpenAPI, además de comprobar aislamiento, revisiones, medios, retiros y consultas. Las de CRM-LAB verifican la proyección pública y que el vínculo catastral privado no se emita. La prueba integrada en VPS separados sigue pendiente de despliegue.

La propuesta original de protocolo y sus objetivos operativos está en [sincronización](../docs/03-contrato-y-sincronizacion.md). El estado implementado y los límites actuales se documentan en [PORTAL-LAB](../PORTAL-LAB/README.md).

# Presupuesto para ocho CRM y un portal

Consulta del 9 de octubre de 2026. El usuario confirmó ocho VPS nuevos para CRM-LAB. Se agrega un noveno VPS para PORTAL-LAB. No se realizó compra ni cotización contractual.

## Dimensionamiento inicial

Proponer un VPS de 1 vCPU y 4 GB por CRM, sin Chatwoot, modelos de IA ni compilación local. Para el portal, 2 vCPU y 8 GB. Son puntos de partida para una prueba de carga, no capacidad garantizada. Si el CRM requiere más CPU, subir de plan solo esa instalación.

Hipótesis de datos: 500 propiedades por inmobiliaria, hasta 4.000 inmuebles en total y 12 fotos por inmueble. Con derivados de 300 KB, el portal necesita aproximadamente 14,4 GB de imágenes; cada CRM, 1,8 GB de derivados y 12 GB de originales de 2 MB. Reservar espacio para base, logs, temporales y versiones. Las cifras crecen si hay más fotos u originales mayores; fijar cuotas y alertar antes del 70% de disco.

## Referencia Hostinger global en USD

| Concepto | Cantidad | Oferta mensual equivalente | Renovación mensual equivalente |
| --- | ---: | ---: | ---: |
| KVM 1 para CRM | 8 | 8 × 6,49 = 51,92 USD | 8 × 11,99 = 95,92 USD |
| KVM 2 para portal | 1 | 8,99 USD | 14,99 USD |
| Total de VPS | 9 | **60,91 USD** | **110,91 USD** |

Valores de la página global, no conversión de pesos. Hostinger indica pago anticipado y que la cifra mensual es un prorrateo. Confirmar el plazo promocional, región, impuestos y total de compra; la renovación publicada corresponde a dos años. [Fuente](https://www.hostinger.com/vps-hosting).

Ejemplo puramente aritmético si esos precios se aplicaran durante 24 meses: 1.461,84 USD por los nueve VPS en el primer período y 2.661,84 USD al renovar a esas tasas. No es un checkout verificado ni debe asumirse que admite pago mes a mes.

## Referencia local en ARS

| Concepto | Oferta mensual equivalente | Renovación mensual equivalente |
| --- | ---: | ---: |
| Ocho KVM 1 | 96.792 ARS | 193.592 ARS |
| Un KVM 2 | 17.699 ARS | 31.399 ARS |
| Total VPS | **114.491 ARS** | **224.991 ARS** |

Los valores unitarios locales observados fueron 12.099/24.199 ARS para KVM 1 y 17.699/31.399 ARS para KVM 2. No mezclar esta tabla con la global: son ofertas regionales distintas. Confirmar impuestos, plazo y total final. [Hostinger Argentina](https://www.hostinger.com/ar/vps-argentina).

## Costos adicionales

| Concepto | Reserva mensual de planificación | Observación |
| --- | ---: | --- |
| Copias externas | 5–10 USD | Reserva, no tarifa cerrada; medir volumen y restauraciones |
| Dominio del portal | 2 USD equivalentes | Supuesto de 24 USD/año, cotizar extensión y renovación |
| Correo | 0–10 USD | Reutilización o capacidad adicional; ocho buzones nuevos pueden excederlo |
| Licencias del núcleo abierto | 0 USD | No incluye trabajo de operación |
| Monitoreo básico | 0 USD adicional previsto | Usar recursos existentes y verificar cobertura externa |

Referencia para copias: B2 publica almacenamiento desde 6,95 USD/TB/mes. Un volumen medio de 0,3 TB da aproximadamente 2,09 USD de almacenamiento, antes de condiciones de transferencia y otros consumos; la reserva de 5–10 USD deja margen. No corresponde multiplicar automáticamente todo el volumen por cada backup gracias a deduplicación, ni asumir deduplicación perfecta de dumps. [B2](https://www.backblaze.com/cloud-storage/pricing).

Presupuesto técnico orientativo: **68–83 USD/mes equivalentes al inicio** y **118–133 USD/mes a las tasas de renovación**. Redondear la reserva operativa a 70–85 y 120–135 USD respectivamente. Sin impuestos, desarrollo, administración, canales pagos, IA ni guardias. Si se reparte por igual entre ocho inmobiliarias: unos 8,50–10,40 USD iniciales y 14,75–16,65 USD en renovación por inmobiliaria, antes de esas exclusiones.

## Costo humano y forma de ahorrar

El costo total es infraestructura + horas de mantenimiento × tarifa acordada + desarrollo + consumos de canales. Como reserva inicial a validar, dedicar 6–10 horas mensuales a actualizaciones, backups y soporte normal de las nueve máquinas; incidentes y onboarding se presupuestan aparte. No es una garantía de esfuerzo suficiente.

Comprar primero los servidores necesarios para dos CRM y el portal de prueba. Ampliar a ocho tras superar recuperación y compatibilidad evita pagar meses de máquinas ociosas. El presupuesto final sí contempla las nueve instalaciones.

Hetzner es una alternativa a cotizar por facturación y ubicación; su página consultada no expuso precios numéricos estables, por lo que no se presenta una comparación inventada. Comparar total anual, renovación, región, IPv4, tráfico, backups y latencia desde Argentina, no solo el anuncio mensual. [Proveedor](https://www.hetzner.com/cloud/).

Compartir un VPS entre ocho CRM reduciría costo, pero incumpliría el requisito de servidor separado y no es la propuesta. Tampoco se presupuestan ocho Chatwoot: cualquier instalación omnicanal requiere dimensionamiento y costo adicionales.

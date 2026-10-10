# PORTAL-LAB

Producto público independiente con las publicaciones autorizadas de ocho inmobiliarias. Este directorio todavía no contiene una aplicación ejecutable.

## Responsabilidades

Buscador, filtros, ficha, galería, páginas de inmobiliarias, SEO, consultas y administración de conexiones. Utiliza PostgreSQL propio y copias locales de fotografías públicas. Implementa el contrato común de CRM-LAB sin acoplarse a sus tablas internas.

## Datos permitidos

Ficha pública, medios aprobados y datos comerciales de la inmobiliaria. Conserva temporalmente datos personales de consultas para entregarlas al CRM correcto; no es un sistema sin datos personales. No recibe propietarios, notas internas, negociaciones ni agenda completa.

## Independencia

Puede mostrar su catálogo durante una caída temporal de un CRM. La propuesta es ocultar publicaciones tras 72 horas sin reconciliación, con alertas previas. Las consultas pendientes quedan registradas hasta entrega o vencimiento informado.

Ver [arquitectura](../docs/01-arquitectura.md), [sincronización](../docs/03-contrato-y-sincronizacion.md) y [costos](../docs/04-costos.md).

# Cómo colaborar

El primer CRM está en fase piloto. Leer el [README](README.md), la [entrega actual](docs/09-entrega-crm-mvp.md), el [alcance v2](docs/06-mvp-y-laboratorio.md), la [arquitectura](docs/01-arquitectura.md) y el [contrato](contracts/README.md). CRM-LAB y PORTAL-LAB se despliegan por separado; el diseño contempla ocho instalaciones CRM independientes.

## Cambios propuestos

1. Definir una tarea pequeña con criterios observables de aceptación.
2. Trabajar en una rama y vincularla al problema que resuelve.
3. Documentar cambios, evidencia y limitaciones en el pull request.
4. Solicitar revisión de otra persona antes de fusionar.

Los documentos deben distinguir hechos comprobados, recomendaciones y supuestos. Las cifras estimadas deben incluir unidad, alcance y método. Los cambios de arquitectura deben actualizar el registro de decisiones.

## Uso de IA

La persona que entrega el cambio revisa las sugerencias y responde por su contenido. No incluir secretos ni datos reales en ejemplos, instrucciones, capturas o pruebas. Cuando la IA haya tenido un papel relevante, registrar brevemente la herramienta, la tarea y cómo se verificó el resultado.

## Código y licencias

CRM-LAB adopta AGPL-3.0-only mediante `CRM-LAB/LICENSE`. Conservar los avisos de dependencias y facilitar el código correspondiente de las versiones distribuidas bajo esa licencia. No copiar código de otros proyectos sin comprobar su licencia. Repositorio público: [javierdicamillo/CRM-LAB](https://github.com/javierdicamillo/CRM-LAB). El directorio local corresponde a este monorepo.

Ejecutar los controles de `CRM-LAB/README.md`; el workflow `.github/workflows/crm.yml` los ejecuta en GitHub Actions; comprobar el resultado del commit antes de fusionar. Los cambios al contrato deben verificar ambos productos y compatibilidad con la versión anterior. No presentar pruebas futuras como aprobadas.

# Referencia de diseño

Lo que sobrevive de las carpetas `complemento`, `complemento2` y `complemento3`,
que eran el mismo Welcome Kit triplicado (1,6 GB) más estas maquetas. El kit
vive en `backend/data/raw/`; aquí queda solo el diseño.

| Archivo | Qué aporta |
|---------|------------|
| `maqueta-resumen-empresa.html` | Resumen por empresa: evolución histórica, comparación por proceso, acordeón resumen → causas → evidencia. Origen de §5.1, §5.2 y §5.4 del spec |
| `maqueta-comparador-empresas.html` | Comparador entre empresas con selección múltiple y vista lista/detalle. Origen de §5.3 |
| `maqueta-radar-empresas.html` | Variante del radar |
| `maqueta-publicacion-original.html` | Maqueta de publicación mensual del kit base |
| `dashboard-liquidaciones-original.html` | Dashboard original, ya integrado al portal |
| `coes-logo.png` | Marca |

Cada maqueta carga su `*.datos.js`, que invoca la función `__REVISIONES__` que
la propia maqueta define. Los nombres se renombraron al rescatarlas y las
referencias `<script src=…>` se actualizaron en consecuencia: se abren con
doble clic, sin servidor.

El spec que las traduce al portal es
`docs/superpowers/specs/2026-09-15-portal-analitico-design.md`.

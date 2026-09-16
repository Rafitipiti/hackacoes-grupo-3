# Portal COES — capa analítica, identidad de empresa y sistema de diseño

**Fecha:** 2026-09-15
**Estado:** propuesto, pendiente de aprobación
**Spec previo:** `2026-09-15-coes-consolidacion-design.md` (sigue vigente; este lo extiende)

---

## 1. Por qué

El portal ya está publicado y es funcional: cinco secciones, selector global de
periodo y empresa, catálogo de 23 endpoints, exportación a CSV. Lo que le falta
es lo que convierte un tablero en una herramienta de análisis: **comparar**. Hoy
el usuario ve un mes aislado y no puede responder "¿esto es normal para esta
empresa?" sin salirse de la página.

Las maquetas de `complemento2` y `complemento3` ya resolvieron esa pregunta con
un lenguaje visual concreto. Este spec captura ese lenguaje y lo lleva al
portal.

---

## 2. Decisiones

| # | Decisión | Razón |
|---|----------|-------|
| D1 | Adoptar los tokens de las maquetas como sistema de color | Traen paleta de series, modo oscuro completo y el mismo patrón de tres selectores que ya usa `tokens.css` |
| D2 | Azul (no verde) para lo positivo | Las maquetas usan `--pos:#2a78d6`. Evita el verde/rojo de juicio de valor que §7.1 del spec previo prohíbe |
| D3 | Los gráficos se construyen con Recharts | Ya es dependencia. Las maquetas usan SVG a mano; Recharts da tooltip, responsive y accesibilidad sin reescribirlos |
| D4 | El selector de empresa solo ofrece empresas con datos en el periodo elegido | 57 de 131 códigos no tienen liquidación nunca; elegir uno lleva a una pantalla de error |
| D5 | Las empresas se muestran con razón social y RUC | Decisión del usuario, 2026-09-15 |
| D6 | La procedencia del dato se documenta en "Calidad y trazabilidad", sin avisos en las pantallas principales | Petición explícita del usuario de no interrumpir la presentación, conservando el rastro donde corresponde |
| D7 | Las carpetas `complemento*` se reducen a los archivos de diseño | 1,6 GB que son el mismo Welcome Kit triplicado, ya presente en `backend/data/raw/` |
| D8 | El filtro de publicación (periodo) y empresa se ubica en la parte superior derecha de la pantalla, fuera de la barra lateral | Decisión del usuario, 2026-09-15. Es la selección que gobierna todas las secciones: debe verse en el mismo sitio en cada pantalla y sin desplazarse |

---

## 3. Identidad de empresa (D5)

### 3.1 Lo que hay

| Fuente | Contenido |
|--------|-----------|
| Welcome Kit (fuente del portal) | `EMPRESA_001`…`EMPRESA_131`; el campo `emprruc` contiene el literal `RUC_EMPRESA_001`, no un RUC |
| `dim_empresa` actual | `empresa_id` + `alias` de fantasía generado barajando prefijos y sufijos con semilla fija |
| `data/simulado_liquidaciones_COES_2024-09_2026-08.xlsx` | 87 empresas reales del COES con RUC y razón social reales |

No existe clave común entre ambas fuentes: el alias no guarda relación con
ninguna empresa real, así que **no hay cruce posible por razón social**. La
asignación es una adjudicación nueva, no una recuperación de identidad.

### 3.2 Regla de asignación

- Solo reciben identidad real los **74 códigos que llevan alguna liquidación**
  en `fact_evolucion`. Los otros 57 conservan su alias y, con D4, no aparecen
  en el selector.
- La asignación es determinista: códigos ordenados por `empresa_id`, empresas
  reales ordenadas por RUC, emparejados por posición. Misma entrada, misma
  salida, como el resto del ETL.
- Un RUC no se asigna nunca a dos códigos.
- `dim_empresa` pasa a tener `empresa_id`, `alias`, `ruc`, `razon_social`.

### 3.3 Lo que esto implica, dicho sin rodeos

Las cifras de liquidación del portal son simuladas. Al ponerles encima nombres y
RUC de empresas reales e identificables, la página pasa a mostrar montos,
variaciones y alertas atribuidos a empresas que existen y que no tuvieron esos
resultados. Quien vea una pantalla fuera de la presentación no tiene cómo
saberlo.

Por eso D6 conserva la procedencia documentada en "Calidad y trazabilidad".
No es un aviso decorativo: es lo único que queda en el producto capaz de
desmentir una lectura falsa. Las pantallas principales van limpias.

---

## 4. Sistema de diseño (D1, D2)

Tokens que se incorporan a `frontend/src/estilos/tokens.css`, respetando el
patrón de tres selectores ya existente:

```
--surface-1 --plane --surface-2 --surface-3
--text-primary --text-secondary --text-muted
--grid --axis --border
--serie-1 #2a78d6   --serie-2 #eb6834   --serie-3 #1baf7a   --serie-4 #eda100
--pos #2a78d6       --neg #d03b3b
--warning #fab219   --critical #d03b3b  --good #0ca30c
--radio 10px        --sombra …
```

Cada par de color de texto sobre su fondo debe verificarse a 4.5:1 y cada
elemento no textual a 3:1 antes de darse por bueno. El spec previo documenta
en `docs/accesibilidad.md` qué está verificado y cómo.

---

## 5. Secciones analíticas nuevas

### 5.1 Evolución histórica (de `complemento3`)

Serie temporal por empresa a lo largo de los 20 periodos, con dos líneas:

- **Liquidación total** del periodo
- **Efecto neto de recálculos** — la suma de los ajustes entre revisiones

El mes seleccionado se destaca. Los meses sintéticos se marcan en el eje con el
componente `MarcaSintetico` que ya existe.

Requiere endpoint nuevo: `GET /empresa/historico/{empresa_id}`.

**Trampa conocida:** `monto_total` es el importe reexpresado completo, no el
ajuste. Sumar entre revisiones lo cuenta dos veces. El efecto neto se obtiene
con la diferencia contra la revisión anterior, como ya hace
`revision_service.impacto_de_publicacion`.

### 5.2 Comparación por proceso (de `complemento3`)

Barras por proceso (LVTA, LVTP, LSCIO, SST-SCT) contrastando el periodo actual
con el anterior, y el delta de cada uno. Responde "¿qué proceso movió mi
liquidación?" sin leer una tabla.

### 5.3 Comparador entre empresas (de `complemento2`)

Vista lista / detalle con selección múltiple de empresas, "Seleccionar todas" y
"Limpiar", contrastando monto restatado y revisión. Es la aportación propia de
`complemento2` y no existe hoy en el portal.

### 5.4 Contexto, trazabilidad e impacto (de `complemento3`)

Acordeón de secciones (`estado.abierta`) que encadena resumen → causas →
evidencia. El portal ya tiene los endpoints; falta la presentación progresiva.

---

## 6. Correcciones de presentación

| # | Qué | Dónde |
|---|-----|-------|
| C1 | Tildes en todo el texto visible | Todo el frontend. La convención "sin tildes" aplicaba a identificadores de código, no a la interfaz |
| C2 | `S/` no debe quedar separado del número al partir la línea | Envolver importe en un contenedor sin salto |
| C3 | "Estado del radar" y "Estado de validación" con tratamiento visual de distintivo, no de texto suelto | Panorama y Mi empresa |
| C4 | Descarga a Excel en el detalle de "Analizar" | Reutilizar `lib/exportar.js`, añadiendo hoja de cálculo |
| C5 | El selector de empresa respeta el periodo (D4) | `SeleccionGlobal.jsx` + `/empresas?pericodi=` |
| C6 | El selector global (publicación y empresa) pasa de la barra lateral a una franja superior alineada a la derecha (D8). La barra lateral conserva navegación, marca y tema | `Layout.jsx`, `layout.css`. En pantalla angosta la franja se apila debajo de la cabecera de sección, sin ocultarse |

---

## 7. Limpieza de `complemento*` (D7)

### 7.1 Se conserva, movido a `docs/referencia-diseno/`

| Archivo | Por qué |
|---------|---------|
| `complemento2/…/maqueta_publicacion_mensual.html` | Comparador entre empresas (§5.3) |
| `complemento3/…/maqueta_publicacion_mensual.html` | Resumen por empresa (§5.1, §5.2, §5.4) |
| `complemento3/…/radar_empresas.html` | Variante de radar |
| `complemento/dashboard_liquidaciones_coes.html` | Dashboard original ya integrado; referencia del diseño vigente |
| `complemento2/…/coes-logo.png` | Marca |
| `maqueta_revisiones_datos.js` (las tres variantes) | Datos que alimentan las maquetas; sin ellos no abren |

### 7.2 Se elimina

Las tres copias del Welcome Kit (`00_WELCOME KIT HACKACOES/` salvo lo listado
arriba): datasets JSON, PDFs, READMEs y scripts de ejemplo. Son idénticos entre
sí — verificado por comparación binaria — y el kit ya vive en
`backend/data/raw/`.

**Esta eliminación no se ejecuta sin confirmación explícita del usuario sobre
la lista final.**

---

## 8. Fuera de alcance

- Sustituir la fuente de datos del portal por el libro `simulado_liquidaciones`.
  Es un dataset real y grande, con estructura propia, y cambiaría el proyecto
  entero. Queda anotado como opción.
- Conectar con Supabase. Sigue siendo la segunda etapa.

---

## 9. Ampliación (2026-09-15, tarde): módulos que faltaban

Petición del usuario sobre lo ya implementado: habilitar las dos entradas
del menú que seguían en "Próximo" y añadir tres capacidades. Se
documentan aquí para que el spec siga siendo la fuente de verdad.

| # | Decisión | Razón |
|---|----------|-------|
| D9 | "Procesos" y "Red y precios" dejan de ser próximos y se construyen | El menú ya prometía el mapa del producto; ahora existe |
| D10 | **Pagos y cobros por proceso** salen de `fact_bilateral` (deudora → acreedora, por LVTA, LVTP, LSCIO y SST-SCT) | Es la única tabla con las dos puntas de cada transferencia. Un monto positivo de la deudora a la acreedora es un pago de la primera y un cobro de la segunda |
| D11 | **Mapa y perfiles**: mapa del Perú con las barras como puntos y curva diaria del costo marginal por barra y periodo, con periodos apilables al hacer clic | El kit no trae coordenadas. Se estiman por nombre de barra contra una tabla de localidades conocidas; las que no se reconocen se marcan como "ubicación aproximada" y así se declara en Calidad |
| D13 | Las pantallas **no etiquetan** los periodos proyectados ("sintético"): ni en el selector, ni en ejes, tooltips o tablas. La procedencia se explica solo en Calidad y trazabilidad, como "proyectado" | Decisión del usuario, 2026-09-16: el COES autorizó usar la proyección en la presentación y la etiqueta la ensuciaba. El campo `origen` de la API se conserva |
| D12 | **Contactos**: ficha por empresa (razón social, RUC, tipo de cuenta, moneda, correos, número de cuenta, teléfonos, CCI, banco, notas) guardada en un libro Excel del backend | El usuario pide lo visual primero; la migración a Supabase queda como etapa posterior. El Excel es texto plano: la ficha lleva el aviso de no cargar datos bancarios reales en la demo |

### 9.1 Procesos: pagos y cobros

Por empresa y periodo, para cada proceso: cuánto paga (es deudora), cuánto
cobra (es acreedora), el neto, y la lista de contrapartes con su monto.
Diagrama de barras divergentes por proceso (pagos a un lado, cobros al
otro) y tabla contraparte a contraparte con razón social y RUC.

Endpoint nuevo: `GET /empresa/pagos-cobros/{empresa_id}/{pericodi}`.

### 9.2 Red y precios: mapa y perfiles

- Mapa del Perú (SVG propio, sin dependencias externas) con un punto por
  barra. Tamaño o color según el costo marginal promedio del periodo.
- Al elegir una barra, curva del costo marginal diario del periodo
  seleccionado. Cada clic en otro periodo **añade** una línea con su
  propio color; se pueden quitar una a una. Eje X: día del mes.
- Fuente: `costos_marginales_diario` (capa curada, 244 barras × 20
  periodos). El libro `spotPriceBarraRevisado` trae la misma serie a 15
  minutos para 304 barras; queda como fuente para un perfil intradía
  posterior.

Endpoints nuevos: `GET /red/barras` (con coordenadas estimadas y CMg
promedio del periodo) y `GET /red/cmg/{barrcodi}/{pericodi}`.

### 9.3 Contactos

Ficha editable por empresa. Persistencia en `backend/data/contactos.xlsx`
(una hoja, una fila por empresa) mediante `GET /contactos/{empresa_id}` y
`PUT /contactos/{empresa_id}`. `openpyxl` entra a `requirements.txt`.

**Aviso en la ficha:** el libro no está cifrado ni controlado por acceso;
en la demo no deben cargarse cuentas bancarias reales.

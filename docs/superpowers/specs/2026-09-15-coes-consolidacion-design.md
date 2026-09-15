# Consolidación del Monitor de Liquidaciones COES — Diseño

**Fecha:** 2026-09-15
**Estado:** aprobado como base, sujeto a modificaciones
**Alcance:** fase 1 — unificación, limpieza e integración de módulos. Supabase queda para fase 2.

---

## 1. Por qué existe este documento

El proyecto creció en tres frentes que no se conocen entre sí:

1. **El repo actual** — React + FastAPI, con un análisis causal de liquidaciones ya construido.
2. **El welcome kit oficial de HackaCOES** (`complemento/00_WELCOME KIT HACKACOES`) — los datasets originales, más una extensión a 20 meses, un historial de revisiones y un portal de referencia.
3. **Dos dashboards HTML** (`complemento/*.html`) — 13 pestañas de análisis sectorial.

Hay duplicación (140 MB de datos copiados byte a byte), código muerto (~10.000 líneas) y activos valiosos que nadie está usando — en particular el dataset que resuelve el problema declarado en el README del proyecto.

Este spec centraliza qué hay, qué se descarta, qué se integra y cómo queda la arquitectura.

---

## 2. Diagnóstico verificado

Todo lo que sigue se comprobó contra los archivos, no se infirió.

### 2.1 Tres universos de datos, dos redundantes

| Fuente | Contenido | Estado |
|---|---|---|
| `backend/liquidaciones.csv` | 500 filas sintéticas, agentes `AGE001`, conceptos genéricos | **Muerto** — ningún endpoint que lo use es consumido por el frontend |
| `backend/data/coes/**.json` (140 MB) | 19 datasets del kit COES, 8 meses (2026-01…2026-08) | **Copia obsoleta** — los 19 archivos son byte-idénticos (md5) a los del welcome kit, y les faltan las versiones extendidas y `revisiones/` |
| `data/*.xlsx` | 323.742 liquidaciones con RUC real y `codigoInforme`; precio spot 15-min por barra | **Sin conectar** — no cruza con el universo anonimizado |

### 2.2 El welcome kit tiene lo que el repo no

| Activo | Volumen | Por qué importa |
|---|---|---|
| `revisiones/` | 29.875 + 16.925 + 80 filas (conteo medido sobre los archivos; el README del kit cita 35.662 y 19.679, de una generación anterior) | Historial R0→R4 por proceso × empresa × período, con calendario de publicaciones. **Es exactamente el problema que el README del proyecto dice resolver** ("trazabilidad débil entre R1 y R2") y no está implementado en ningún lado |
| `*_extendido.json` (15 datasets) | 8 → **20 meses**, 403k → **1,17 M filas** | Habilita comparación interanual. Cada fila lleva `origen: real \| sintetico` |
| `portal/` | 1.116 líneas JS | App vanilla modular, con hook `registrarPanel`, estado en URL, claro/oscuro, paleta daltónica y semántica de variaciones ya resuelta |
| `scripts/` | 1.355 líneas Python | `generar_backcast_2025.py`, `generar_revisiones.py`, `preparar_datos_portal.py` — deterministas y auditables |
| `inventario_datasets.json`, 7 × `contexto.md`, PDFs de mentores | — | Diccionario de datos oficial y contexto de dominio |

El `README_BACKCAST_2025.md` documenta un hallazgo aprovechable como material de sustentación: **la cadena de cálculo regulatoria no es reproducible desde el kit**. Los retiros cubren 12 de 71 empresas, el costo marginal cubre 248 de 828 barras, y LVTA viene como una sola fila sin desglosar. Los datasets son *resultados* de consultas a producción, no *insumos* de un modelo recalculable.

### 2.3 Los tres frentes son complementarios

| Frente | Aporta |
|---|---|
| `portal/` | Arquitectura modular y semántica de variaciones |
| `dashboard_liquidaciones_coes.html` | Amplitud analítica (13 tabs, ~60 renderers SVG, cero dependencias externas) y el sistema de diseño HackaCOES |
| Repo actual | El **porqué**: `AgentService`, `IntegrityService`, flujo causal A1→A7 |

El propio `portal/README.md` declara que su "próximo paso natural" es explicar el porqué de cada variación — que es precisamente lo que ya hace el backend FastAPI.

### 2.4 Código muerto confirmado

- **Frontend:** `App_bk.jsx`, `App_bk2.jsx` (270), `App_bk3.jsx` (3.365), `App_bk.css`, `index_bk.css`, `text.jsx` → ≈4.300 líneas.
- **Backend:** `llm.py`, `analyst_service.py`, `traceability_service.py` están **vacíos** (0 líneas). `diagnostico_a4.py` es un script suelto.
- **Bloques `if __name__ == "__main__"`:** 587 líneas en `agent_service.py`, 146 en `integrity_service.py`, 21 en `analysis.py` → 754 líneas de pruebas ad-hoc.
- **`main.py`:** `/periodos` está definido dos veces (líneas 247 y 271); la segunda pisa a la primera.
- **Endpoints nunca llamados por el frontend:** `/agentes`, `/conceptos`, `/liquidaciones/*`, `/analisis/*`, `/comparacion-interanual/*`. El frontend solo consume `/periodos`, `/empresas`, `/radar/{fecha}` y `/agente/*`.
- **`complemento/COES · Monitoreo de Liquidaciones _ Prototipo.html`:** roto — referencia una carpeta `_files/` con CSS, JS y datos que no existe en el repo.

### 2.5 Los pericodi hardcodeados no son un problema

Los valores `138`/`139` encontrados en `agent_service.py` están **todos dentro del bloque `__main__`**. La clase `AgentService` (líneas 1–3682) es agnóstica al período: soporta los 20 meses del dataset extendido sin cambios de lógica.

### 2.6 Incompatibilidad de claves entre universos

- **Empresas:** el kit está anonimizado (`EMPRESA_001`, `RUC_EMPRESA_072`); el XLSX tiene RUCs reales de SUNAT. Intersección: **0 de 87**.
- **Barras:** cruzan por nombre base (216 de 239) pero **no por ID** (`barrcodi` 512 vs `id` 1487).
- **Períodos:** la ventana común es 2026-01…2026-08.

---

## 3. Decisiones

| # | Decisión | Razón |
|---|---|---|
| D1 | Una sola app React modular, que absorbe los módulos útiles del HTML | Un solo producto que mantener |
| D2 | React + FastAPI **desplegados** (Vercel + Render/Railway) | El análisis causal debe funcionar para cualquier empresa y período |
| D3 | Supabase queda para **fase 2** | Priorizar lo demostrable ante directivos del COES |
| D4 | `EMPRESA_00X` sigue siendo la clave técnica; la UI muestra un **alias de fantasía** | Cumple la regla 8.2 del kit ("no re-identificar") sin sacrificar concreción en la demo. El RUC real nunca aparece |
| D5 | Se adopta el **dataset extendido (20 meses) + `revisiones/`** | Habilita interanual y el módulo diferenciador |
| D6 | La lógica del `portal/` se porta a módulos React; `portal/` se elimina | Su arquitectura y su semántica de variaciones son mejores que lo que hay hoy |
| D7 | 13 tabs se reorganizan en **6 secciones**, 3 de ellas priorizadas | 13 pestañas sueltas es ruido para una audiencia directiva |
| D8 | El XLSX y el spot 15-min **no entran en fase 1** | El spot es redundante con `costos_marginales` del kit y no cruza con el universo anonimizado |

---

## 4. Arquitectura

```
Vercel (estático)              Render/Railway (FastAPI)
┌──────────────────┐  HTTPS   ┌─────────────────────────┐
│  React 19 + Vite │ ───────► │  app/routers/           │
│  Recharts + SVG  │          │  app/services/          │
└──────────────────┘          │  data/curated/*.parquet │
                              └─────────────────────────┘
```

### 4.1 Mitigación del cold start

El free tier duerme el backend a los ~15 minutos de inactividad, lo que produciría ~50 s de espera en la primera carga.

1. **Keep-alive:** `GET /health` pingeado cada 10 minutos desde un cron externo gratuito durante la ventana de demostración.
2. **Bootstrap precompilado:** el build del frontend genera un `bootstrap.json` con el panorama del último período y el catálogo de empresas. La primera pantalla pinta en menos de un segundo aunque el backend esté despertando; el resto se hidrata después.
3. **Estado de carga explícito por módulo.** Nunca una pantalla en blanco.

---

## 5. Capa de datos (fase 1)

El dataset extendido son 1,22 M filas y 406 MB en JSON. Cargarlo con `pandas.read_json` al arrancar tarda ~40 s y no cabe cómodo en los 512 MB de RAM del free tier. La solución es una capa curada.

```
backend/data/
├── raw/          el welcome kit, fuera de git (.gitignore)
└── curated/      parquet, versionado, ~40-60 MB
    ├── dim_empresa.parquet       EMPRESA_00X → alias visible
    ├── dim_periodo.parquet       20 períodos, estado, version_vigente
    ├── dim_barra.parquet
    ├── fact_evolucion.parquet    109.458
    ├── fact_bilateral.parquet    141.816
    ├── fact_revisiones.parquet   29.875   ⭐
    ├── fact_calendario.parquet   80       ⭐
    ├── fact_desglose.parquet     unifica potencia + sstsct + lscio
    └── agg_*.parquet             CMg diario, perfil intradía, entregas y
                                  retiros preagregados a lo que la UI muestra
```

`scripts/preparar_datos.py` construye `curated/` desde `raw/`. Determinista y reejecutable. Parquet reduce el peso unas 8× y el arranque a segundos.

**Los datos crudos salen de git.** Hoy hay 140 MB versionados; el historial ya los contiene y limpiarlo queda fuera de alcance, pero dejamos de agregar.

**Alias de empresa:** `dim_empresa.parquet` mapea cada `EMPRESA_00X` a un nombre de fantasía estable y determinista. La clave técnica no cambia. El mapeo se documenta en la UI como ficticio.

**Marcado de datos sintéticos:** el campo `origen` viaja hasta el frontend. Los meses de 2025 se muestran con trama diagonal y aviso en cabecera.

---

## 6. Backend

### 6.1 Se elimina (~2.400 líneas)

`liquidaciones.csv`, `data_generator.py`, `ml_model.py`, ~900 líneas de `analysis.py` (sobrevive únicamente `calcular_score_relevancia`, usada por `/radar` en la línea 596), los 754 de bloques `__main__`, `diagnostico_a4.py`, los tres archivos vacíos, los 7 endpoints muertos y el `/periodos` duplicado.

### 6.2 Se reorganiza

`main.py` (1.267 líneas monolíticas) se divide en routers:

```
app/routers/    panorama.py · empresa.py · procesos.py · revisiones.py · calidad.py
app/services/   agent_service.py · integrity_service.py · revision_service.py ⭐
app/data/       loader.py (lee parquet en vez de JSON)
```

### 6.3 Se agrega: `revision_service.py`

El módulo diferenciador, construido sobre `revisiones/`:

| Endpoint | Qué responde |
|---|---|
| `GET /revisiones/calendario/{pericodi}` | Qué trae la publicación de ese mes: R0 propio, R1 del anterior, R2 del transanterior, y las R3/R4 rezagadas |
| `GET /revisiones/cascada/{empresa}/{pericodi}` | La cadena R0→R4 de un mes, con el ajuste de cada salto |
| `GET /revisiones/impacto/{pericodi}` | Cuánto dinero de meses anteriores entra en esa publicación |

**Regla de dominio a respetar:** `monto` en `revisiones` es el monto restatado completo del mes, no el ajuste. Sumar montos de varias revisiones del mismo mes sería doble contabilidad. El ajuste es la diferencia contra la revisión anterior.

---

## 7. Frontend

`App.jsx` (7.912 líneas en una sola función `App()`) se rompe en:

```
src/
├── app/           router, layout, tema, estado global (empresa · período)
├── secciones/     Panorama · MiEmpresa · Procesos · Revisiones · Red · Calidad
├── componentes/   tarjetas, tablas, controles, indicador de variación
├── graficos/      renderers portados del dashboard + envoltorios Recharts
├── lib/           formato.js · variaciones.js · datos.js   ← portados del portal/
└── api/           cliente axios, un módulo por router
```

### 7.1 Semántica de variaciones (portada del `portal/`)

Un porcentaje engaña en tres casos, y la UI los distingue:

| Caso | Qué muestra |
|---|---|
| Normal | `+12,3 %` |
| El monto cambia de signo (de cobrar a pagar) | `↔ −S/ 205 k` — es un cambio de posición, no un `−384 %` |
| Variación mayor a ±999 % | `Δ −S/ 232 k` |
| Sin período base, o base en cero | `s/d` |

Las flechas ▲▼ indican **dirección**, no si algo es bueno o malo: en liquidaciones un aumento es favorable o desfavorable según si la empresa cobra o paga. El color se reserva para la **magnitud** (`Revisar` ≥25 %, `Fuerte` ≥50 %).

### 7.2 Las 7 secciones

El problema que resuelve esta reorganización: hoy el menú tiene **dos entradas**
y todo lo demás está enterrado dentro del flujo A1→A7. El usuario entra por "Mi
liquidación", elige empresa, y recién ahí descubre que hay siete pantallas
encadenadas, sin forma de saltar entre ellas ni de saber que existen. El backend
expone 23 endpoints; la UI deja ver una fracción.

| Orden | Sección | Contenido | Backend |
|---|---|---|---|
| 1 | **Cáscara, navegación y diseño** | Barra lateral, selectores globales de período y empresa, sistema de diseño | — |
| 2 | **Ciclo y revisiones** ⭐ | Calendario de publicaciones, cascada R0→R4 por proceso, impacto de arrastre | ✅ `/revisiones/*` |
| 3 | **APIs y descargas** | Catálogo de los 23 endpoints, probador en vivo, exportación por proceso/período/revisión | ✅ los existentes |
| 4 | **Mi empresa** | Flujo causal A1→A7, reorganizado como pestañas navegables en vez de túnel | ✅ 15 × `/agente/*` |
| 5 | **Panorama** | Radar de variaciones, monto por proceso y mes, mayores cobradoras y pagadoras | ✅ `/radar` |
| 6 | **Procesos** | VTEA · VTP · SCIO · SST-SCT con selector | ❌ **falta endpoint** |
| 7 | **Red y precios** | Mapa del SEIN, intradía 15 min, costo marginal | ❌ **falta endpoint** |

El orden es de prioridad, no de aparición en el menú. Responde a un criterio:
**primero lo visible y lo que ya tiene backend.** Las secciones 6 y 7 requieren
exponer tablas curadas que hoy ningún endpoint lee (`fact_desglose`,
`fact_evolucion`, `agg_cmg_diario`, `agg_perfil_intradia`) — es el hallazgo de
"ocho tablas curadas sin lector" de la revisión final. Entran si el plazo lo
permite.

**Selectores globales.** Período y empresa se eligen una vez en la barra lateral
y todas las secciones responden a esa selección. Hoy hay que volver al inicio
para cambiar de empresa, lo que convierte cualquier comparación en una odisea.

**El selector de empresa es un buscador.** Son 131 empresas; un `<select>` plano
es inusable. Entrada de texto con filtrado por substring, lista ordenada
alfabéticamente por alias con comparación de locale español.

**Sección de APIs.** Catálogo navegable de los endpoints con descripción y
parámetros, un probador que ejecuta la llamada en vivo y muestra la respuesta, y
un exportador que arma CSV o JSON filtrando por proceso, período y revisión
sobre los endpoints existentes. Es lo que convierte la plataforma en algo que
una empresa del sector puede consumir, no solo mirar.

El simulador y el cruce bilateral quedan embebidos en Panorama y Procesos. No se
pierde contenido: se ordena.

### 7.3 Estrategia de portado de gráficos

Portar ~60 renderers SVG es el grueso del trabajo.

- Las secciones 🟡 **montan los renderers existentes dentro de un componente React con `useRef`**, inyectando el SVG tal cual, sin reescribirlo.
- Solo las secciones 🔴 se reescriben con Recharts.

Eso convierte "reescribir 60 gráficos" en "reescribir ~15".

---

## 8. Sistema de diseño

Base: los tokens del `dashboard_liquidaciones_coes.html` — degradado oficial HackaCOES, modo claro y oscuro ya resueltos — más las reglas de accesibilidad del `portal/`: paleta validada para daltonismo, tooltips en todas las marcas, y ninguna información transmitida solo por color.

Un único `tokens.css`. Se eliminan `App.css` (5.505 líneas) y los `*_bk.css`.

---

## 9. Inventario de eliminación

| Qué | Magnitud |
|---|---|
| `App_bk.jsx`, `App_bk2.jsx`, `App_bk3.jsx`, `App_bk.css`, `index_bk.css`, `text.jsx` | ≈4.300 líneas |
| Backend muerto (§6.1) | ≈2.400 líneas |
| `App.css` al reescribirse | 5.505 → ~800 líneas |
| `backend/data/coes/` | 140 MB, copia byte-idéntica del kit |
| `complemento/COES · … Prototipo.html` | roto, sin sus `_files/` |
| `portal/` completo (tras portar su lógica) | 1.116 líneas + `datos/` regenerable |
| PDFs, agendas y presentaciones del kit | 5 MB, fuera del repo |

Total aproximado: **~12.500 líneas y ~145 MB.** De esas, ~7.800 son borrado puro y ~4.700 corresponden a la reducción de `App.css` al reescribirse sobre el sistema de tokens.

---

## 10. Riesgos

| Riesgo | Mitigación |
|---|---|
| Cold start del free tier frente a directivos | §4.1: keep-alive + bootstrap precompilado |
| Volumen de portado de gráficos | §7.3: solo se reescriben las secciones 🔴 |
| RAM del free tier con 1,22 M filas | §5: capa curada en parquet con preagregados |
| Que el jurado lea el alias como re-identificación | D4: alias explícitamente ficticio, RUC real nunca presente, aviso en la UI |
| Confundir datos sintéticos con reales | Campo `origen` propagado hasta la UI, trama diagonal y aviso en cabecera |

---

## 11. Fuera de alcance (fase 2)

- Migración a Supabase de la capa curada.
- Incorporación del XLSX de liquidaciones con RUC real y `codigoInforme` como módulo documental independiente.
- Incorporación del precio spot 15-min, previa tabla de mapeo `barrcodi` ↔ `id`.
- Limpieza del historial de git para purgar los 140 MB ya versionados.
- Descomposición de variaciones en drivers (energía, costo marginal, cambio de versión), el "próximo paso natural" que declara el `portal/`.

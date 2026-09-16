# Frontend Unificado — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconstruir el frontend con una cáscara de navegación que haga visibles los módulos que hoy están enterrados, el sistema de diseño del dashboard HackaCOES, y dos secciones nuevas — ciclo de revisiones y un catálogo de APIs con descargas.

**Architecture:** Una cáscara nueva (`src/app/`) provee barra lateral, selectores globales de período y empresa, y tema claro/oscuro. Las secciones nuevas se escriben limpias contra la API. El flujo causal A1→A7 y el radar, que hoy funcionan, se conservan: `App.jsx` se renombra a `LegacyApp.jsx` y se monta dentro de las secciones que los necesitan, recibiendo por prop el modo a mostrar. Eso evita reescribir 7.912 líneas de lógica que ya pasó revisión.

**Tech Stack:** React 19, Vite 8, Recharts, axios, vitest (nuevo, para los módulos de lógica pura).

**Spec:** `docs/superpowers/specs/2026-09-15-coes-consolidacion-design.md` — secciones 7 y 8.

## Global Constraints

- **El alias es lo único visible.** `EMPRESA_00X` es la clave técnica que viaja a la API; nunca aparece en pantalla. (Spec D4)
- **Las 131 empresas se listan ordenadas alfabéticamente por alias**, con `localeCompare(…, "es", { sensitivity: "base" })`. (Spec §7.2)
- **`origen` se propaga hasta la UI.** Los meses con `origen: "sintetico"` (todo 2025) se marcan visualmente y con aviso, nunca se muestran como si fueran reales. (Spec §5)
- **Las flechas ▲▼ indican dirección, no si algo es bueno o malo.** En liquidaciones un aumento es favorable o desfavorable según si la empresa cobra o paga. El color se reserva para la magnitud. (Spec §7.1)
- **Ninguna información se transmite solo por color.** Siempre hay texto o ícono acompañando. (Spec §8)
- **Todo el texto de la interfaz va en español**, con tildes correctas.
- **Accesibilidad, nivel WCAG 2.1 AA.** Es un portal del sector eléctrico peruano, con usuarios institucionales: contraste mínimo 4.5:1 en texto normal y 3:1 en texto grande e íconos; todo operable con teclado; foco siempre visible; cada control con nombre accesible; `prefers-reduced-motion` respetado. No es un adorno del final: se construye desde el primer archivo de estilos.
- **Vocabulario del dominio, no del software.** El usuario es un analista del COES o de una empresa del sector: se dice "liquidación", "revisión", "período", "barra", "SEIN". Nunca "registro", "query", "endpoint" fuera de la sección de APIs.
- **`LegacyApp.jsx` se toca lo mínimo imprescindible.** Son 7.912 líneas en una sola función; cada cambio fuera de lo especificado es riesgo puro.

## Estructura de archivos

```
frontend/src/
├── main.jsx                      monta <Aplicacion/>
├── LegacyApp.jsx                 el App.jsx actual, renombrado, con una prop nueva
├── App.css                       se conserva: lo usa LegacyApp
├── app/
│   ├── Aplicacion.jsx            cáscara: layout + sección activa + providers
│   ├── Layout.jsx                barra lateral, cabecera, área de contenido
│   ├── SeleccionGlobal.jsx       selectores de período y empresa
│   ├── contexto.jsx              SeleccionContext + useSeleccion()
│   └── secciones.js              catálogo de secciones (id, título, ícono, componente)
├── estilos/
│   ├── tokens.css                tokens del dashboard, claro y oscuro
│   └── base.css                  reset, tipografía, componentes base
├── secciones/
│   ├── CicloRevisiones.jsx       ⭐ nueva
│   ├── ApisDescargas.jsx         ⭐ nueva
│   ├── MiEmpresa.jsx             envuelve LegacyApp en modo agente
│   ├── Panorama.jsx              envuelve LegacyApp en modo analista
│   └── Calidad.jsx               integridad, glosario y limitaciones
├── componentes/
│   ├── Tarjeta.jsx
│   ├── Variacion.jsx             semántica de variaciones del portal
│   ├── EstadoCarga.jsx
│   └── MarcaSintetico.jsx
├── lib/
│   ├── formato.js                soles, números, porcentajes
│   ├── variaciones.js            semántica del portal
│   └── exportar.js               CSV y JSON desde respuestas de la API
└── api/
    ├── cliente.js                axios con base URL
    ├── catalogos.js              periodos, empresas
    └── revisiones.js             cascada, calendario, impacto
```

**Fuera de alcance de este plan:** las secciones **Procesos** y **Red y precios**. Requieren exponer tablas curadas que hoy ningún endpoint lee (`fact_desglose`, `fact_evolucion`, `agg_cmg_diario`, `agg_perfil_intradia`). Aparecen en el menú como "Próximamente" para que se vea el mapa completo del producto, pero su construcción es un plan aparte que empieza por el backend.

---

### Task 1: Sistema de diseño

**Files:**
- Create: `frontend/src/estilos/tokens.css`
- Create: `frontend/src/estilos/base.css`
- Modify: `frontend/index.html` (fuentes)

**Interfaces:**
- Consumes: nada.
- Produces: variables CSS `--bg`, `--surface`, `--surface-2`, `--surface-3`, `--ink`, `--ink-2`, `--ink-muted`, `--border`, `--accent`, `--s1`..`--s4`, `--seq1`..`--seq7`, `--ok`, `--bad`, `--warn`, `--crit`, `--good`, `--grad`, `--shadow`; y las clases base `.tarjeta`, `.tabla`, `.etiqueta`, `.boton`, `.boton-secundario`.

- [ ] **Step 1: Crear `tokens.css` con los valores del dashboard**

Son los tokens de `complemento/dashboard_liquidaciones_coes.html`, copiados literalmente. El degradado y los colores vienen de las presentaciones oficiales de HackaCOES.

```css
/* Identidad HackaCOES 2026. Tomado de
   complemento/dashboard_liquidaciones_coes.html sin modificar los valores. */

:root {
  color-scheme: light;

  --bg:#F1F5FA; --surface:#ffffff; --surface-2:#EDF2F8; --surface-3:#DFE8F3;
  --ink:#0F1A2E; --ink-2:#47546B; --ink-muted:#6B7688;
  --grid:#E4EBF3; --axis:#C3CEDC; --border:rgba(0,36,130,.14);
  --accent:#005BA7;
  --s1:#005BA7; --s2:#D4622E; --s3:#6A3FA0; --s4:#D99A00;
  --warn:#fab219; --crit:#d03b3b; --good:#0ca30c;
  /* --warn y --good sirven para rellenos y marcas, donde el minimo es 3:1.
     Como color de TEXTO sobre fondo claro dan 1.83:1 y 3.35:1, insuficiente.
     Estas variantes dan 5.28:1 y 6.44:1 sin salirse de la gama. El valor de
     identidad no se toca: se le agrega un companero legible. */
  --warn-texto:#96600A;
  --good-texto:#0a6e1c;
  --sobre-accent:#ffffff;
  --seq1:#DCE8F7; --seq2:#BBD3EE; --seq3:#93B8E2; --seq4:#5F94D0;
  --seq5:#2E6DB8; --seq6:#114F97; --seq7:#002482;
  --shadow:0 1px 2px rgba(0,36,130,.06);
  --grad:linear-gradient(90deg,#002482 0%,#005BA7 17%,#209DD3 32%,#6E73BC 49%,#944785 64%,#CB252A 79%,#EE8729 91%,#F5C354 100%);
  --ok:#0C7C3E; --bad:#C0392B;

  --radio:10px;
  --fuente:"Poppins", system-ui, -apple-system, sans-serif;
  --fuente-mono:"IBM Plex Mono", ui-monospace, monospace;
}

/* Oscuro por preferencia del sistema, salvo que el usuario haya pedido claro. */
@media (prefers-color-scheme: dark) {
  :root:not([data-tema="claro"]) {
    color-scheme: dark;

    --bg:#0A0E19; --surface:#141A2B; --surface-2:#1C2438; --surface-3:#273148;
    --ink:#EEF3FA; --ink-2:#B4C0D2; --ink-muted:#7E8CA3;
    --grid:#232C42; --axis:#35405A; --border:rgba(255,255,255,.13);
    --accent:#4193DA;
    /* Texto sobre el acento: en oscuro el acento aclara y el blanco cae a
       3.3:1. Tinta oscura sobre el mismo acento da 6.3:1. */
    --sobre-accent:#0A0E19;
    /* Los colores de estado se recalibran para fondo oscuro. Los tres
       valores ya pertenecen a la paleta oficial. */
    --warn:#F5C354; --crit:#E8736A; --good:#3BC46F;
    --warn-texto:#F5C354; --good-texto:#3BC46F;
    --s1:#4193DA; --s2:#CC6330; --s3:#8F72D6; --s4:#B8871A;
    --seq1:#002482; --seq2:#114F97; --seq3:#2E6DB8; --seq4:#5F94D0;
    --seq5:#93B8E2; --seq6:#BBD3EE; --seq7:#DCE8F7;
    --shadow:none;
    --grad:linear-gradient(90deg,#2E6DB8 0%,#4193DA 16%,#38B0E0 31%,#8F9BE0 48%,#C07BB4 64%,#E2564F 80%,#F08F3C 92%,#F5C354 100%);
    --ok:#3BC46F; --bad:#E8736A;
  }
}

/* Oscuro elegido explicitamente por el usuario. */
:root[data-tema="oscuro"] {
  color-scheme: dark;

  --bg:#0A0E19; --surface:#141A2B; --surface-2:#1C2438; --surface-3:#273148;
  --ink:#EEF3FA; --ink-2:#B4C0D2; --ink-muted:#7E8CA3;
  --grid:#232C42; --axis:#35405A; --border:rgba(255,255,255,.13);
  --accent:#4193DA;
  --sobre-accent:#0A0E19;
  --warn:#F5C354; --crit:#E8736A; --good:#3BC46F;
  --warn-texto:#F5C354; --good-texto:#3BC46F;
  --s1:#4193DA; --s2:#CC6330; --s3:#8F72D6; --s4:#B8871A;
  --seq1:#002482; --seq2:#114F97; --seq3:#2E6DB8; --seq4:#5F94D0;
  --seq5:#93B8E2; --seq6:#BBD3EE; --seq7:#DCE8F7;
  --shadow:none;
  --grad:linear-gradient(90deg,#2E6DB8 0%,#4193DA 16%,#38B0E0 31%,#8F9BE0 48%,#C07BB4 64%,#E2564F 80%,#F08F3C 92%,#F5C354 100%);
  --ok:#3BC46F; --bad:#E8736A;
}

/* Alto contraste. Va al final y repite los selectores de cada modo para
   empatar su especificidad: un :root suelto vale (0,1,0) y pierde contra
   los bloques de modo oscuro, que valen (0,2,0). Sin esto el refuerzo
   queda inerte justo para quien combina modo oscuro con alto contraste. */
@media (prefers-contrast: more) {
  :root,
  :root:not([data-tema="claro"]),
  :root[data-tema="oscuro"] {
    --border: var(--ink-2);
    --grid: var(--ink-muted);
  }
}
```

- [ ] **Step 2: Crear `base.css`**

```css
*, *::before, *::after { box-sizing: border-box; }

body {
  margin: 0;
  background: var(--bg);
  color: var(--ink);
  font-family: var(--fuente);
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

h1, h2, h3 { margin: 0 0 8px; font-weight: 600; letter-spacing: -.01em; }
h1 { font-size: 22px; }
h2 { font-size: 16px; }
h3 { font-size: 14px; }

.cifra { font-family: var(--fuente-mono); font-variant-numeric: tabular-nums; }

.tarjeta {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radio);
  box-shadow: var(--shadow);
  padding: 16px;
}

.etiqueta {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: var(--ink-2);
}

.tabla { width: 100%; border-collapse: collapse; font-size: 13px; }
.tabla th {
  text-align: left;
  font-size: 11px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--ink-2);
  font-weight: 600;
  padding: 8px 10px;
  border-bottom: 1px solid var(--border);
}
.tabla td { padding: 9px 10px; border-bottom: 1px solid var(--grid); }
.tabla td.num { text-align: right; font-family: var(--fuente-mono); font-variant-numeric: tabular-nums; }
.tabla tbody tr:hover { background: var(--surface-2); }

.boton {
  background: var(--accent);
  color: var(--sobre-accent);
  border: 0;
  border-radius: 8px;
  padding: 9px 16px;
  font-family: var(--fuente);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}
.boton:hover { filter: brightness(1.08); }
.boton:disabled { opacity: .45; cursor: not-allowed; }

.boton-secundario {
  background: var(--surface-2);
  color: var(--ink);
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 8px 14px;
  font-family: var(--fuente);
  font-size: 13px;
  cursor: pointer;
}
.boton-secundario:hover { background: var(--surface-3); }

.franja-grad { height: 3px; background: var(--grad); border: 0; margin: 0; }

/* ── Accesibilidad ──────────────────────────────────────────────────
   Es un portal institucional del sector electrico peruano. Estas reglas
   no son decoracion: son el piso sobre el que se construye todo lo demas. */

/* Foco siempre visible. El navegador lo oculta en clics de raton y lo
   muestra en navegacion por teclado, que es justo lo que queremos. */
:where(a, button, input, select, textarea, summary, [tabindex]):focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
  border-radius: 4px;
}

/* Salto al contenido: primer tabulador de la pagina, invisible hasta
   que recibe foco. Para quien navega con teclado o lector de pantalla,
   evita recorrer el menu completo en cada pantalla. */
.saltar-al-contenido {
  position: absolute;
  left: -9999px;
  top: 8px;
  z-index: 100;
  background: var(--accent);
  color: var(--sobre-accent);
  padding: 10px 16px;
  border-radius: 8px;
  font-weight: 600;
}
.saltar-al-contenido:focus {
  left: 8px;
}

/* Texto visible solo para lectores de pantalla. */
.solo-lectores {
  position: absolute;
  width: 1px; height: 1px;
  padding: 0; margin: -1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
  border: 0;
}

/* Quien pidio menos movimiento, recibe menos movimiento. */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
    scroll-behavior: auto !important;
  }
}

/* El area tactil minima recomendada es 44px. En escritorio se permite
   menos, pero en pantallas tactiles no. */
@media (pointer: coarse) {
  .boton, .boton-secundario { min-height: 44px; }
}

@media (max-width: 860px) {
  body { font-size: 13px; }
}
```

> **Sobre el contraste de los tokens.** La paleta viene de las presentaciones
> oficiales de HackaCOES y está validada para daltonismo, pero no todos sus
> colores alcanzan 4.5:1 sobre cualquier fondo. La regla práctica para este
> proyecto: `--ink` y `--ink-2` para texto, **incluidos los encabezados de
> tabla y las etiquetas** — un encabezado de columna es el unico lugar donde
> se dice que significa esa columna, asi que transmite informacion unica;
> `--ink-muted` **solo** para notas y estados de apoyo, y aun asi con
> 4.59:1 medidos; `--warn`,
> `--crit` y `--good` nunca solos — siempre con ícono o etiqueta de texto al
> lado, que es lo que ya hace el componente `Variacion`.

- [ ] **Step 3: Cargar las fuentes en `index.html`**

Dentro de `<head>`, antes del `<script type="module">`, agregar:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
```

- [ ] **Step 4: Verificar que compila**

Run desde `frontend/`: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/estilos/ frontend/index.html
git commit -m "feat: sistema de diseno con los tokens de HackaCOES

Tokens copiados sin modificar de complemento/dashboard_liquidaciones_coes.html:
degradado oficial, modo claro y oscuro, y paleta secuencial. Mas una capa
base con tipografia Poppins e IBM Plex Mono para cifras."
```

---

### Task 2: Formato y semántica de variaciones

Los dos módulos de lógica pura del frontend. Son los únicos que llevan tests: el resto es composición visual que se verifica en el navegador.

**Files:**
- Modify: `frontend/package.json` (vitest)
- Create: `frontend/src/lib/formato.js`
- Create: `frontend/src/lib/variaciones.js`
- Test: `frontend/src/lib/formato.test.js`
- Test: `frontend/src/lib/variaciones.test.js`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `soles(monto: number, decimales = 2) -> string`
  - `numero(valor: number, decimales = 2) -> string`
  - `porcentaje(fraccion: number, decimales = 1) -> string`
  - `clasificarVariacion(actual: number, anterior: number) -> { tipo, texto, delta, pct, magnitud }` donde `tipo` ∈ `"normal" | "cambio-signo" | "fuera-de-rango" | "sin-dato"` y `magnitud` ∈ `"normal" | "revisar" | "fuerte"`

- [ ] **Step 1: Instalar vitest**

Run desde `frontend/`: `npm install --save-dev vitest`

Agregar a `frontend/package.json`, dentro de `"scripts"`:

```json
"test": "vitest run"
```

- [ ] **Step 2: Escribir los tests que fallan**

`frontend/src/lib/formato.test.js`:

```js
import { describe, expect, it } from "vitest";

import { numero, porcentaje, soles } from "./formato.js";

describe("soles", () => {
  it("usa separador de miles y simbolo peruano", () => {
    expect(soles(1282616.13)).toBe("S/ 1,282,616.13");
  });

  it("conserva el signo negativo", () => {
    expect(soles(-4515658.58)).toBe("-S/ 4,515,658.58");
  });

  it("devuelve un guion cuando no hay dato", () => {
    expect(soles(null)).toBe("—");
    expect(soles(undefined)).toBe("—");
  });
});

describe("porcentaje", () => {
  it("convierte una fraccion a porcentaje con signo", () => {
    expect(porcentaje(-0.027)).toBe("-2.7%");
    expect(porcentaje(0.1234)).toBe("+12.3%");
  });

  it("devuelve un guion cuando no hay dato", () => {
    expect(porcentaje(null)).toBe("—");
  });
});

describe("numero", () => {
  it("formatea con separador de miles", () => {
    expect(numero(109.26081)).toBe("109.26");
  });
});
```

`frontend/src/lib/variaciones.test.js`:

```js
import { describe, expect, it } from "vitest";

import { clasificarVariacion } from "./variaciones.js";

describe("clasificarVariacion", () => {
  it("el caso normal trae porcentaje", () => {
    const v = clasificarVariacion(112.3, 100);

    expect(v.tipo).toBe("normal");
    expect(v.texto).toBe("+12.3%");
  });

  it("un cambio de signo NO se muestra como porcentaje", () => {
    // De cobrar 205.000 a pagar 60.000 no es "-129%": es un cambio de
    // posicion, y el porcentaje solo confunde.
    const v = clasificarVariacion(-60000, 205000);

    expect(v.tipo).toBe("cambio-signo");
    expect(v.texto).toContain("↔");
    expect(v.texto).not.toContain("%");
  });

  it("una variacion mayor a 999% muestra el delta, no el porcentaje", () => {
    const v = clasificarVariacion(50000, 10);

    expect(v.tipo).toBe("fuera-de-rango");
    expect(v.texto).toContain("Δ");
    expect(v.texto).not.toContain("%");
  });

  it("sin periodo base devuelve sin dato", () => {
    expect(clasificarVariacion(100, null).tipo).toBe("sin-dato");
    expect(clasificarVariacion(100, 0).tipo).toBe("sin-dato");
    expect(clasificarVariacion(100, null).texto).toBe("s/d");
  });

  it("el signo del delta va antes del simbolo de moneda", () => {
    // Es el formato que usa soles() en todo el modulo: -S/ 50 k, no S/ -50 k.
    const v = clasificarVariacion(-50000, -10);

    expect(v.tipo).toBe("fuera-de-rango");
    expect(v.texto).toContain("-S/");
    expect(v.texto).not.toContain("S/ -");
  });

  it("el limite de 999% deja el borde del lado del porcentaje", () => {
    expect(clasificarVariacion(1099, 100).tipo).toBe("normal");
    expect(clasificarVariacion(1099.01, 100).tipo).toBe("fuera-de-rango");
  });

  it("dos periodos negativos comparan como cualquier otro par", () => {
    // Una cuenta que paga menos que antes. El sistema reporta la direccion
    // numerica y no opina sobre si eso es bueno: depende de si la empresa
    // cobra o paga, y solo el usuario lo sabe.
    const v = clasificarVariacion(-50, -100);

    expect(v.tipo).toBe("normal");
    expect(v.texto).toBe("+50.0%");
  });

  it("clasifica la magnitud para disparar la atencion", () => {
    expect(clasificarVariacion(110, 100).magnitud).toBe("normal");
    expect(clasificarVariacion(130, 100).magnitud).toBe("revisar");
    expect(clasificarVariacion(160, 100).magnitud).toBe("fuerte");
  });

  it("la magnitud no depende del signo: bajar 60% tambien es fuerte", () => {
    expect(clasificarVariacion(40, 100).magnitud).toBe("fuerte");
  });
});
```

- [ ] **Step 3: Correr los tests para verificar que fallan**

Run desde `frontend/`: `npm test`
Expected: FAIL, no existen los módulos.

- [ ] **Step 4: Escribir `formato.js`**

```js
const SIN_DATO = "—";

function hayDato(valor) {
  return valor !== null && valor !== undefined && !Number.isNaN(valor);
}

export function numero(valor, decimales = 2) {
  if (!hayDato(valor)) return SIN_DATO;

  return valor.toLocaleString("en-US", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}

export function soles(monto, decimales = 2) {
  if (!hayDato(monto)) return SIN_DATO;

  const signo = monto < 0 ? "-" : "";

  return `${signo}S/ ${numero(Math.abs(monto), decimales)}`;
}

export function porcentaje(fraccion, decimales = 1) {
  if (!hayDato(fraccion)) return SIN_DATO;

  const signo = fraccion > 0 ? "+" : "";

  return `${signo}${(fraccion * 100).toFixed(decimales)}%`;
}
```

- [ ] **Step 5: Escribir `variaciones.js`**

```js
import { soles } from "./formato.js";

// Umbrales de magnitud. Marcan cuanto merece atencion una variacion,
// no si es buena o mala: en liquidaciones subir es favorable o no segun
// si la empresa cobra o paga.
const UMBRAL_REVISAR = 0.25;
const UMBRAL_FUERTE = 0.5;

// Por encima de esto el porcentaje deja de informar y se muestra el delta.
const LIMITE_PORCENTAJE = 9.99;

function magnitudDe(pct) {
  const absoluto = Math.abs(pct);

  if (absoluto >= UMBRAL_FUERTE) return "fuerte";
  if (absoluto >= UMBRAL_REVISAR) return "revisar";

  return "normal";
}

function abreviar(monto) {
  const absoluto = Math.abs(monto);

  if (absoluto >= 1e6) return `${(monto / 1e6).toFixed(1)} M`;
  if (absoluto >= 1e3) return `${(monto / 1e3).toFixed(0)} k`;

  return monto.toFixed(0);
}

/**
 * Clasifica una variacion entre dos periodos.
 *
 * Un porcentaje engaña en tres casos, y los tres se distinguen aqui:
 * cuando el monto cambia de signo (pasar de cobrar a pagar no es un
 * porcentaje, es un cambio de posicion), cuando la variacion es tan
 * grande que el porcentaje deja de informar, y cuando no hay base
 * contra la cual comparar.
 */
export function clasificarVariacion(actual, anterior) {
  const faltaDato =
    actual === null || actual === undefined ||
    anterior === null || anterior === undefined ||
    anterior === 0;

  if (faltaDato) {
    return { tipo: "sin-dato", texto: "s/d", delta: null, pct: null, magnitud: "normal" };
  }

  const delta = actual - anterior;
  const pct = delta / Math.abs(anterior);

  if (Math.sign(actual) !== Math.sign(anterior) && actual !== 0) {
    return {
      tipo: "cambio-signo",
      texto: `↔ ${soles(delta, 0)}`,
      delta,
      pct,
      magnitud: magnitudDe(pct),
    };
  }

  if (Math.abs(pct) > LIMITE_PORCENTAJE) {
    // El signo va antes del simbolo de moneda, igual que en soles().
    // abreviar() solo formatea la magnitud.
    const signo = delta < 0 ? "-" : "";

    return {
      tipo: "fuera-de-rango",
      texto: `Δ ${signo}S/ ${abreviar(Math.abs(delta))}`,
      delta,
      pct,
      magnitud: "fuerte",
    };
  }

  const signo = pct > 0 ? "+" : "";

  return {
    tipo: "normal",
    texto: `${signo}${(pct * 100).toFixed(1)}%`,
    delta,
    pct,
    magnitud: magnitudDe(pct),
  };
}
```

- [ ] **Step 6: Correr los tests para verificar que pasan**

Run desde `frontend/`: `npm test`
Expected: PASS, los 15.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/
git commit -m "feat: formato de cifras y semantica de variaciones

Portado del portal de referencia del welcome kit. Un porcentaje engana en
tres casos y los tres se distinguen: cambio de signo, variacion fuera de
rango y ausencia de base. La magnitud clasifica cuanto merece atencion, no
si algo es bueno o malo."
```

---

### Task 3: Cáscara, navegación y selección global

**Files:**
- Create: `frontend/src/app/contexto.jsx`
- Create: `frontend/src/app/secciones.js`
- Create: `frontend/src/app/SeleccionGlobal.jsx`
- Create: `frontend/src/app/Layout.jsx`
- Create: `frontend/src/app/Aplicacion.jsx`
- Create: `frontend/src/app/layout.css`
- Modify: `frontend/src/main.jsx`

**Interfaces:**
- Consumes: `tokens.css`, `base.css` de Task 1.
- Produces:
  - `useSeleccion() -> { periodo, setPeriodo, empresa, setEmpresa, periodos, empresas, cargando, error }` — `empresa` es la clave técnica `EMPRESA_00X` o `null`
  - `SECCIONES: Array<{ id, titulo, icono, descripcion, disponible }>`
  - `<Aplicacion/>` como raíz de la app

- [ ] **Step 1: Crear el contexto de selección**

`frontend/src/app/contexto.jsx`:

```jsx
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

const SeleccionContext = createContext(null);

export function useSeleccion() {
  const contexto = useContext(SeleccionContext);

  if (!contexto) {
    throw new Error("useSeleccion debe usarse dentro de <ProveedorSeleccion>");
  }

  return contexto;
}

export function ProveedorSeleccion({ children }) {
  const [periodos, setPeriodos] = useState([]);
  const [empresas, setEmpresas] = useState([]);
  const [periodo, setPeriodo] = useState(null);
  const [empresa, setEmpresa] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Evita escribir estado si el componente se desmonta a media carga.
    let vigente = true;

    async function cargar() {
      try {
        const [respPeriodos, respEmpresas] = await Promise.all([
          axios.get(`${API_URL}/periodos`),
          axios.get(`${API_URL}/empresas`),
        ]);

        if (!vigente) return;

        const listaPeriodos = respPeriodos.data.periodos;

        if (!listaPeriodos || listaPeriodos.length === 0) {
          throw new Error("El servicio no devolvio ningun periodo.");
        }

        setPeriodos(listaPeriodos);
        setEmpresas(respEmpresas.data.empresas ?? []);

        // Arranca en el ultimo periodo CERRADO, no en el mas reciente.
        // Los periodos abiertos no tienen reportes intermedios cargados, asi
        // que la pantalla saldria vacia en la primera impresion.
        const cerrados = listaPeriodos.filter((p) => p.estado === "Cerrado");
        const inicial = cerrados.length
          ? cerrados[cerrados.length - 1]
          : listaPeriodos[listaPeriodos.length - 1];

        setPeriodo(inicial.pericodi);
      } catch (e) {
        if (!vigente) return;

        setError(
          e.response ? `el servicio respondio ${e.response.status}` : e.message,
        );
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();

    return () => { vigente = false; };
  }, []);

  const valor = useMemo(
    () => ({ periodo, setPeriodo, empresa, setEmpresa, periodos, empresas, cargando, error }),
    [periodo, empresa, periodos, empresas, cargando, error],
  );

  return (
    <SeleccionContext.Provider value={valor}>
      {children}
    </SeleccionContext.Provider>
  );
}
```

- [ ] **Step 2: Crear el catálogo de secciones**

`frontend/src/app/secciones.js`:

```js
// El orden es el del menu. `disponible: false` pinta la entrada como
// proxima, para que se vea el mapa completo del producto sin fingir que
// esta construido.
export const SECCIONES = [
  {
    id: "panorama",
    titulo: "Panorama",
    icono: "▤",
    descripcion: "El sector en un vistazo",
    disponible: true,
  },
  {
    id: "mi-empresa",
    titulo: "Mi empresa",
    icono: "◉",
    descripcion: "Que cambio en mi liquidacion y por que",
    disponible: true,
  },
  {
    id: "revisiones",
    titulo: "Ciclo y revisiones",
    icono: "↻",
    descripcion: "Como evoluciona una liquidacion entre publicaciones",
    disponible: true,
  },
  {
    id: "calidad",
    titulo: "Calidad y trazabilidad",
    icono: "✓",
    descripcion: "Reglas de integridad y limites del dato",
    disponible: true,
  },
  {
    id: "apis",
    titulo: "APIs y descargas",
    icono: "↧",
    descripcion: "Consulta y exporta los datos",
    disponible: true,
  },
  {
    id: "procesos",
    titulo: "Procesos",
    icono: "⚡",
    descripcion: "VTEA · VTP · SCIO · SST-SCT",
    disponible: false,
  },
  {
    id: "red",
    titulo: "Red y precios",
    icono: "◈",
    descripcion: "Mapa del SEIN, intradia y costo marginal",
    disponible: false,
  },
];
```

- [ ] **Step 3: Crear los selectores globales**

`frontend/src/app/SeleccionGlobal.jsx`:

```jsx
import { useMemo, useState } from "react";

import { useSeleccion } from "./contexto.jsx";

export function SeleccionGlobal() {
  const { periodo, setPeriodo, empresa, setEmpresa, periodos, empresas } = useSeleccion();
  const [busqueda, setBusqueda] = useState("");

  // 131 empresas: el orden por clave tecnica se ve aleatorio cuando lo que
  // se muestra es el alias. Se ordena por el texto visible.
  const empresasOrdenadas = useMemo(
    () =>
      [...empresas].sort((a, b) =>
        (a.alias ?? a.empresa_id).localeCompare(b.alias ?? b.empresa_id, "es", {
          sensitivity: "base",
        }),
      ),
    [empresas],
  );

  const periodoActual = periodos.find((p) => p.pericodi === periodo);

  function alEscribir(texto) {
    setBusqueda(texto);

    // Se compara con el mismo criterio con que se ordena la lista:
    // insensible a mayusculas y tildes. Comparar con === haria que un alias
    // bien tecleado pero con otra capitalizacion no resolviera.
    const encontrada = empresas.find(
      (e) =>
        (e.alias ?? e.empresa_id).localeCompare(texto, "es", {
          sensitivity: "base",
        }) === 0,
    );

    setEmpresa(encontrada ? encontrada.empresa_id : null);
  }

  return (
    <div className="seleccion-global">
      <label className="etiqueta" htmlFor="sel-periodo">Periodo</label>
      <select
        id="sel-periodo"
        value={periodo ?? ""}
        onChange={(e) => setPeriodo(Number(e.target.value))}
      >
        {periodos.map((p) => (
          <option key={p.pericodi} value={p.pericodi}>
            {p.perinombre} · {p.estado}
          </option>
        ))}
      </select>

      {periodoActual?.origen === "sintetico" && (
        <p className="aviso-sintetico">
          ⚠ Mes sintetico. Generado para dar profundidad interanual; no son
          cifras publicadas.
        </p>
      )}

      <label className="etiqueta" htmlFor="sel-empresa">Empresa</label>
      <input
        id="sel-empresa"
        list="lista-empresas"
        placeholder="Escribe para buscar..."
        value={busqueda}
        onChange={(e) => alEscribir(e.target.value)}
      />
      <datalist id="lista-empresas">
        {empresasOrdenadas.map((e) => (
          <option key={e.empresa_id} value={e.alias ?? e.empresa_id} />
        ))}
      </datalist>

      {busqueda && !empresa && (
        <p className="aviso-empresa">Sin coincidencia exacta</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Crear el layout**

`frontend/src/app/Layout.jsx`:

```jsx
import { SeleccionGlobal } from "./SeleccionGlobal.jsx";
import { SECCIONES } from "./secciones.js";

export function Layout({ seccionActiva, alCambiarSeccion, tema, alCambiarTema, children }) {
  const seccion = SECCIONES.find((s) => s.id === seccionActiva);

  return (
    <div className="disposicion">
      <a className="saltar-al-contenido" href="#contenido">
        Saltar al contenido
      </a>

      <aside className="barra-lateral">
        <div className="marca">
          <span className="marca-escudo" aria-hidden="true">⚡</span>
          <span className="marca-texto">
            <strong>Liquidaciones 360</strong>
            <span>COES · Sistema Electrico Interconectado Nacional</span>
          </span>
        </div>

        <hr className="franja-grad" aria-hidden="true" />

        {/* aria-current marca la seccion activa para lectores de pantalla:
            el color de fondo solo no comunica nada a quien no lo ve. */}
        <nav aria-label="Secciones del portal">
          {SECCIONES.map((s) => (
            <button
              key={s.id}
              type="button"
              className={
                "enlace-seccion" +
                (s.id === seccionActiva ? " activo" : "") +
                (s.disponible ? "" : " proximo")
              }
              onClick={() => s.disponible && alCambiarSeccion(s.id)}
              disabled={!s.disponible}
              aria-current={s.id === seccionActiva ? "page" : undefined}
            >
              <span className="icono" aria-hidden="true">{s.icono}</span>
              <span className="titulo">
                {s.titulo}
                <small>{s.descripcion}</small>
              </span>
              {!s.disponible && (
                <span className="tag-proximo">
                  Proximo
                  <span className="solo-lectores"> — seccion no disponible todavia</span>
                </span>
              )}
            </button>
          ))}
        </nav>

        <SeleccionGlobal />

        <button
          type="button"
          className="boton-secundario alternar-tema"
          onClick={alCambiarTema}
          aria-pressed={tema === "oscuro"}
        >
          <span aria-hidden="true">{tema === "oscuro" ? "☀" : "☾"}</span>
          {tema === "oscuro" ? " Modo claro" : " Modo oscuro"}
        </button>
      </aside>

      {/* tabIndex -1 permite que el salto al contenido deje el foco aqui. */}
      <main className="contenido" id="contenido" tabIndex={-1}>
        <header className="cabecera-seccion">
          <p className="etiqueta">{seccion?.descripcion}</p>
          <h1>{seccion?.titulo}</h1>
        </header>

        {children}
      </main>
    </div>
  );
}
```

- [ ] **Step 5: Crear `layout.css`**

```css
.disposicion { display: flex; min-height: 100vh; }

.barra-lateral {
  width: 260px;
  flex: 0 0 260px;
  background: var(--surface);
  border-right: 1px solid var(--border);
  padding: 18px 14px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.marca { display: flex; align-items: center; gap: 10px; }
.marca-escudo {
  width: 32px; height: 32px;
  flex: 0 0 32px;
  display: grid;
  place-items: center;
  border-radius: 8px;
  background: var(--grad);
  color: #fff;
  font-size: 16px;
}
.marca-texto { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.marca-texto strong { font-size: 15px; letter-spacing: -.01em; }
.marca-texto span { font-size: 10px; color: var(--ink-muted); line-height: 1.3; }

.barra-lateral nav { display: flex; flex-direction: column; gap: 2px; }

.enlace-seccion {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  padding: 9px 10px;
  border: 0;
  border-left: 3px solid transparent;
  border-radius: 8px;
  background: transparent;
  color: var(--ink-2);
  font-family: var(--fuente);
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: background .12s ease;
}
.enlace-seccion:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }

/* La seccion activa se marca por color, por peso tipografico Y por una
   barra lateral. Tres senales, ninguna dependiente de percibir el color. */
.enlace-seccion.activo {
  background: var(--surface-3);
  border-left-color: var(--accent);
  color: var(--ink);
  font-weight: 600;
}
.enlace-seccion.proximo { opacity: .5; cursor: default; }
.enlace-seccion .icono { width: 18px; text-align: center; line-height: 1.5; }
.enlace-seccion .titulo { flex: 1; display: flex; flex-direction: column; gap: 1px; }
.enlace-seccion .titulo small {
  font-size: 10px;
  font-weight: 400;
  color: var(--ink-muted);
  line-height: 1.3;
}
.enlace-seccion.activo .titulo small { color: var(--ink-2); }

.tag-proximo {
  font-size: 9px;
  letter-spacing: .06em;
  text-transform: uppercase;
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 1px 4px;
}

.seleccion-global { display: flex; flex-direction: column; gap: 6px; margin-top: auto; }
.seleccion-global select,
.seleccion-global input {
  width: 100%;
  padding: 7px 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-2);
  color: var(--ink);
  font-family: var(--fuente);
  font-size: 12px;
}
.seleccion-global input:focus,
.seleccion-global select:focus { outline: 2px solid var(--accent); outline-offset: 1px; }

.aviso-sintetico {
  margin: 0;
  font-size: 11px;
  color: var(--warn-texto);
  background: color-mix(in srgb, var(--warn) 12%, transparent);
  border-radius: 6px;
  padding: 5px 7px;
}
.aviso-empresa { margin: 0; font-size: 11px; color: var(--ink-muted); }

.alternar-tema { width: 100%; }

.estado { padding: 22px; text-align: center; color: var(--ink-muted); font-size: 13px; }
.nota { font-size: 12px; color: var(--ink-muted); margin: 6px 0 0; }

.contenido { flex: 1; padding: 22px 26px; max-width: 1400px; }
.cabecera-seccion { margin-bottom: 18px; }

@media (max-width: 860px) {
  .disposicion { flex-direction: column; }
  .barra-lateral { width: auto; flex: none; border-right: 0; border-bottom: 1px solid var(--border); }
  .contenido { padding: 16px; }
}
```

- [ ] **Step 6: Crear `Aplicacion.jsx`**

Las secciones todavía no existen: en este paso renderizan un marcador. Las tareas siguientes los reemplazan una por una.

```jsx
import { useEffect, useState } from "react";

import { Layout } from "./Layout.jsx";
import { ProveedorSeleccion, useSeleccion } from "./contexto.jsx";

import "../estilos/tokens.css";
import "../estilos/base.css";
import "./layout.css";

const TEMAS = ["auto", "claro", "oscuro"];

function Marcador({ seccion }) {
  return (
    <div className="tarjeta">
      <p>Seccion <strong>{seccion}</strong> en construccion.</p>
    </div>
  );
}

// El spec exige estado de carga explicito: nunca una pantalla en blanco.
// Aplicacion esta por fuera del proveedor, asi que este componente
// intermedio es el que puede leer el contexto.
function Contenido({ seccion }) {
  const { cargando, error } = useSeleccion();

  if (cargando) {
    return <p className="estado">Cargando periodos y empresas…</p>;
  }

  if (error) {
    return (
      <section className="tarjeta">
        <h2>No se pudo conectar con el servicio de liquidaciones</h2>
        <p className="nota">Detalle: {error}</p>
        <p className="nota">
          Comprueba que el servicio este disponible y vuelve a cargar la
          pagina. Si el problema persiste, avisa al equipo del COES.
        </p>
      </section>
    );
  }

  return <Marcador seccion={seccion} />;
}

export function Aplicacion() {
  const [seccion, setSeccion] = useState("panorama");
  // Se valida contra los tres valores permitidos: un valor corrupto en
  // localStorage dejaria data-tema invalido y el boton mintiendo.
  const [tema, setTema] = useState(() => {
    const guardado = localStorage.getItem("coes-tema");
    return TEMAS.includes(guardado) ? guardado : "auto";
  });

  useEffect(() => {
    if (tema === "auto") {
      document.documentElement.removeAttribute("data-tema");
    } else {
      document.documentElement.setAttribute("data-tema", tema);
    }

    localStorage.setItem("coes-tema", tema);
  }, [tema]);

  function alternarTema() {
    setTema((actual) => (actual === "oscuro" ? "claro" : "oscuro"));
  }

  return (
    <ProveedorSeleccion>
      <Layout
        seccionActiva={seccion}
        alCambiarSeccion={setSeccion}
        tema={tema}
        alCambiarTema={alternarTema}
      >
        <Contenido seccion={seccion} />
      </Layout>
    </ProveedorSeleccion>
  );
}
```

- [ ] **Step 7: Apuntar `main.jsx` a la cáscara y eliminar `index.css`**

`index.css` tiene seis líneas (`html { min-height: 100% }` y
`body { min-height: 100vh }`) que `base.css` ya cubre. Al dejar de importarlo,
queda huérfano:

```bash
git rm frontend/src/index.css
```

Reemplazar el contenido completo de `frontend/src/main.jsx`:

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { Aplicacion } from "./app/Aplicacion.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Aplicacion />
  </StrictMode>,
);
```

- [ ] **Step 8: Verificar en el navegador**

Run desde `frontend/`: `npm run build` y luego `npm run dev`

Con el backend corriendo en `127.0.0.1:8000`, abrir `http://localhost:5173` y comprobar:
1. La barra lateral muestra las **7 secciones**, con "Procesos" y "Red y precios" atenuadas y marcadas como "Proximo".
2. El selector de período arranca en un período **Cerrado**, no en 2026.Agosto.
3. El selector de empresa filtra al escribir y la lista está ordenada alfabéticamente.
4. El botón de tema alterna claro y oscuro, y la elección sobrevive a recargar la página.
5. Al elegir un mes de 2025 aparece el aviso de mes sintético.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/app/ frontend/src/main.jsx
git commit -m "feat: cascara con navegacion de siete secciones

El menu anterior tenia dos entradas y todo lo demas estaba enterrado dentro
del flujo A1-A7. Ahora las secciones son visibles, los selectores de periodo
y empresa son globales y persistentes, y el periodo inicial es el ultimo
cerrado: los abiertos no tienen reportes intermedios y la pantalla salia
vacia en la primera impresion."
```

---

### Task 4: Componentes compartidos

**Files:**
- Create: `frontend/src/componentes/Tarjeta.jsx`
- Create: `frontend/src/componentes/Variacion.jsx`
- Create: `frontend/src/componentes/EstadoCarga.jsx`
- Create: `frontend/src/componentes/MarcaSintetico.jsx`
- Create: `frontend/src/componentes/componentes.css`
- Modify: `frontend/src/app/Aplicacion.jsx` (importar `componentes.css`)

**Interfaces:**
- Consumes: `clasificarVariacion` de Task 2.
- Produces:
  - `<Tarjeta titulo? etiqueta? children/>`
  - `<Variacion actual anterior/>` — pinta la variación con la semántica del portal
  - `<EstadoCarga cargando error vacio mensajeVacio children/>`
  - `<MarcaSintetico/>`

- [ ] **Step 1: Crear `Variacion.jsx`**

Es el componente con más criterio del frontend: traduce la semántica de `clasificarVariacion` a algo legible sin engañar.

```jsx
import { clasificarVariacion } from "../lib/variaciones.js";

const TITULOS = {
  "normal": "Variacion respecto del periodo anterior",
  "cambio-signo": "Cambio de posicion: la empresa paso de cobrar a pagar o al reves",
  "fuera-de-rango": "Variacion demasiado grande para expresarla en porcentaje",
  "sin-dato": "Sin periodo base para comparar",
};

export function Variacion({ actual, anterior }) {
  const v = clasificarVariacion(actual, anterior);

  // La flecha indica direccion, nunca si algo es bueno o malo: en
  // liquidaciones subir es favorable o no segun si la empresa cobra o paga.
  const flecha =
    v.delta === null || v.delta === 0 ? "" : v.delta > 0 ? "▲" : "▼";

  return (
    <span
      className={`variacion mag-${v.magnitud} tipo-${v.tipo}`}
      title={TITULOS[v.tipo]}
    >
      {flecha && <span aria-hidden="true">{flecha}</span>}
      <span className="cifra">{v.texto}</span>
      {v.magnitud !== "normal" && (
        <span className="sello">
          {v.magnitud === "fuerte" ? "Fuerte" : "Revisar"}
        </span>
      )}
    </span>
  );
}
```

- [ ] **Step 2: Crear `Tarjeta.jsx`, `EstadoCarga.jsx` y `MarcaSintetico.jsx`**

`Tarjeta.jsx`:

```jsx
export function Tarjeta({ titulo, etiqueta, acciones, children }) {
  return (
    <section className="tarjeta">
      {(titulo || etiqueta || acciones) && (
        <header className="tarjeta-cabecera">
          <div>
            {etiqueta && <p className="etiqueta">{etiqueta}</p>}
            {titulo && <h2>{titulo}</h2>}
          </div>
          {acciones}
        </header>
      )}
      {children}
    </section>
  );
}
```

`EstadoCarga.jsx`:

```jsx
export function EstadoCarga({ cargando, error, vacio, mensajeVacio, children }) {
  if (cargando) {
    return <p className="estado estado-cargando">Cargando…</p>;
  }

  if (error) {
    return (
      <p className="estado estado-error">
        No se pudo cargar: {error}
      </p>
    );
  }

  if (vacio) {
    return (
      <p className="estado estado-vacio">
        {mensajeVacio ?? "No hay datos para esta seleccion."}
      </p>
    );
  }

  return children;
}
```

`MarcaSintetico.jsx`:

```jsx
export function MarcaSintetico() {
  return (
    <span
      className="marca-sintetico"
      title="Mes generado para dar profundidad interanual. No son cifras publicadas."
    >
      sintetico
    </span>
  );
}
```

- [ ] **Step 3: Crear `componentes.css`**

```css
.tarjeta-cabecera {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.variacion { display: inline-flex; align-items: center; gap: 5px; font-size: 13px; }
.variacion .sello {
  font-size: 9px;
  letter-spacing: .06em;
  text-transform: uppercase;
  border-radius: 4px;
  padding: 1px 5px;
}
.variacion.mag-revisar { color: var(--warn-texto); }
.variacion.mag-revisar .sello { background: color-mix(in srgb, var(--warn) 18%, transparent); }
.variacion.mag-fuerte { color: var(--crit); }
.variacion.mag-fuerte .sello { background: color-mix(in srgb, var(--crit) 18%, transparent); }
.variacion.tipo-sin-dato { color: var(--ink-muted); }

.estado { padding: 22px; text-align: center; color: var(--ink-muted); font-size: 13px; }
.estado-error { color: var(--bad); }

.marca-sintetico {
  font-size: 9px;
  letter-spacing: .06em;
  text-transform: uppercase;
  color: var(--warn-texto);
  border: 1px dashed var(--warn);
  border-radius: 4px;
  padding: 1px 5px;
  margin-left: 6px;
}

.rejilla { display: grid; gap: 14px; }
.rejilla-2 { grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); }
.rejilla-3 { grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
```

Importar `componentes.css` en `Aplicacion.jsx`, junto a los demás:

```jsx
import "../componentes/componentes.css";
```

- [ ] **Step 4: Verificar que compila**

Run desde `frontend/`: `npm run build`
Expected: build exitoso.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/componentes/ frontend/src/app/Aplicacion.jsx
git commit -m "feat: componentes compartidos

Variacion traduce la semantica del portal a algo legible: flecha para
direccion, color para magnitud, y titulo explicando por que un cambio de
signo no se muestra como porcentaje."
```

---

### Task 5: Ciclo y revisiones

La sección diferenciadora. Los tres endpoints existen desde el plan anterior y hoy no los consume nadie.

**Files:**
- Create: `frontend/src/api/cliente.js`
- Create: `frontend/src/api/revisiones.js`
- Create: `frontend/src/secciones/CicloRevisiones.jsx`
- Create: `frontend/src/secciones/ciclo.css`
- Modify: `frontend/src/app/Aplicacion.jsx` (montar la sección)

**Interfaces:**
- Consumes: `useSeleccion()`, `<Tarjeta>`, `<Variacion>`, `<EstadoCarga>`, `soles`, `porcentaje`.
- Produces:
  - `cliente` (instancia axios con `baseURL`)
  - `obtenerCascada(empresaId, pericodi)`, `obtenerCalendario(pericodi)`, `obtenerImpacto(pericodi)`

- [ ] **Step 1: Crear el cliente de API**

`frontend/src/api/cliente.js`:

```js
import axios from "axios";

export const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000";

export const cliente = axios.create({ baseURL: API_URL, timeout: 30000 });
```

`frontend/src/api/revisiones.js`:

```js
import { cliente } from "./cliente.js";

export async function obtenerCascada(empresaId, pericodi) {
  const { data } = await cliente.get(`/revisiones/cascada/${empresaId}/${pericodi}`);
  return data;
}

export async function obtenerCalendario(pericodi) {
  const { data } = await cliente.get(`/revisiones/calendario/${pericodi}`);
  return data;
}

export async function obtenerImpacto(pericodi) {
  const { data } = await cliente.get(`/revisiones/impacto/${pericodi}`);
  return data;
}
```

- [ ] **Step 2: Escribir la sección**

`frontend/src/secciones/CicloRevisiones.jsx`:

```jsx
import { useEffect, useState } from "react";

import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { porcentaje, soles } from "../lib/formato.js";
import { obtenerCalendario, obtenerCascada, obtenerImpacto } from "../api/revisiones.js";
import { useSeleccion } from "../app/contexto.jsx";

const NOMBRE_PROCESO = {
  "LVTA": "Energia Activa",
  "LVTP": "Potencia",
  "LSCIO": "Servicios Complementarios",
  "SST-SCT": "Sistemas Secundarios de Transmision",
};

function Impacto({ datos }) {
  const total = Math.abs(datos.corriente) + Math.abs(datos.arrastre);
  const pctArrastre = total === 0 ? 0 : Math.abs(datos.arrastre) / total;

  return (
    <Tarjeta
      etiqueta="Que trae esta publicacion"
      titulo="Del mes corriente y de meses anteriores"
    >
      <div className="rejilla rejilla-2">
        <div className="bloque-impacto">
          <p className="etiqueta">Liquidacion del mes</p>
          <p className="cifra grande">{soles(datos.corriente)}</p>
          <p className="nota">Es la R0, la primera version de este mes.</p>
        </div>

        <div className="bloque-impacto">
          <p className="etiqueta">Ajuste de meses anteriores</p>
          <p className="cifra grande">{soles(datos.arrastre)}</p>
          <p className="nota">
            Suma de los ajustes de {datos.periodos_arrastrados} periodo(s)
            recalculados. Es la diferencia contra su revision previa, no el
            monto completo: sumar montos restatados seria doble contabilidad.
          </p>
        </div>
      </div>

      <div className="barra-proporcion" aria-hidden="true">
        <span style={{ width: `${(1 - pctArrastre) * 100}%` }} className="parte-corriente" />
        <span style={{ width: `${pctArrastre * 100}%` }} className="parte-arrastre" />
      </div>
      <p className="nota">
        El {porcentaje(pctArrastre, 0)} del movimiento de esta publicacion
        corresponde a recalculos de meses anteriores.
      </p>
    </Tarjeta>
  );
}

function Calendario({ entradas }) {
  const porProceso = entradas.reduce((acc, e) => {
    (acc[e.proceso] ??= []).push(e);
    return acc;
  }, {});

  return (
    <Tarjeta
      etiqueta="Calendario de publicacion"
      titulo="Que liquidaciones salen en este mes"
    >
      <p className="nota">
        COES no publica una liquidacion una sola vez: la publicacion de un mes
        trae la R0 de ese mes mas recalculos de meses anteriores.
      </p>

      <div className="rejilla rejilla-2">
        {Object.entries(porProceso).map(([proceso, filas]) => (
          <div key={proceso}>
            <h3>{proceso} · {NOMBRE_PROCESO[proceso] ?? ""}</h3>
            <table className="tabla">
              <thead>
                <tr><th>Mes liquidado</th><th>Revision</th></tr>
              </thead>
              <tbody>
                {filas
                  .sort((a, b) => a.pericodi - b.pericodi)
                  .map((f) => (
                    <tr key={`${f.pericodi}-${f.revision}`}>
                      <td>{f.perianiomes}</td>
                      <td>{f.revision_nombre}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>
    </Tarjeta>
  );
}

function Cascada({ procesos }) {
  return (
    <Tarjeta
      etiqueta="Cascada de revisiones"
      titulo="Como cambio el monto de este mes, revision por revision"
    >
      <p className="nota">
        Cada proceso tiene su propia cadena: un mes puede llegar a R3 en
        Energia Activa y solo a R1 en Potencia. Por eso se muestran separados.
      </p>

      {Object.entries(procesos).map(([proceso, pasos]) => (
        <div key={proceso} className="cadena">
          <h3>{proceso} · {NOMBRE_PROCESO[proceso] ?? ""}</h3>
          <table className="tabla">
            <thead>
              <tr>
                <th>Revision</th>
                <th className="num">Monto restatado</th>
                <th className="num">Ajuste</th>
                <th className="num">%</th>
                <th>Publicada en</th>
              </tr>
            </thead>
            <tbody>
              {pasos.map((p) => (
                <tr key={p.revision}>
                  <td>{p.revision_nombre}</td>
                  <td className="num">{soles(p.monto_total)}</td>
                  <td className="num">{p.ajuste === null ? "—" : soles(p.ajuste)}</td>
                  <td className="num">{p.ajuste_pct === null ? "—" : porcentaje(p.ajuste_pct)}</td>
                  <td>{p.publicacion_pericodi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Tarjeta>
  );
}

export function CicloRevisiones() {
  const { periodo, empresa } = useSeleccion();

  const [impacto, setImpacto] = useState(null);
  const [calendario, setCalendario] = useState(null);
  const [cascada, setCascada] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!periodo) return;

    let vigente = true;
    setCargando(true);
    setError(null);

    async function cargar() {
      try {
        const [i, c] = await Promise.all([
          obtenerImpacto(periodo),
          obtenerCalendario(periodo),
        ]);

        if (!vigente) return;

        setImpacto(i);
        setCalendario(c.entradas);

        if (empresa) {
          const casc = await obtenerCascada(empresa, periodo);
          if (vigente) setCascada(casc.procesos);
        } else {
          setCascada(null);
        }
      } catch (e) {
        if (vigente) setError(e.response?.status === 404 ? "sin datos para este periodo" : e.message);
      } finally {
        if (vigente) setCargando(false);
      }
    }

    cargar();

    return () => { vigente = false; };
  }, [periodo, empresa]);

  return (
    <EstadoCarga cargando={cargando} error={error} vacio={!impacto}>
      <div className="rejilla">
        {impacto && <Impacto datos={impacto} />}
        {calendario && <Calendario entradas={calendario} />}

        {cascada
          ? <Cascada procesos={cascada} />
          : (
            <Tarjeta etiqueta="Cascada de revisiones" titulo="Elige una empresa">
              <p className="nota">
                Selecciona una empresa en la barra lateral para ver como
                evoluciono su liquidacion revision por revision.
              </p>
            </Tarjeta>
          )}
      </div>
    </EstadoCarga>
  );
}
```

- [ ] **Step 3: Crear `ciclo.css`**

```css
.bloque-impacto .grande { font-size: 26px; font-weight: 700; margin: 4px 0; }
.nota { font-size: 12px; color: var(--ink-muted); margin: 4px 0 0; }

.barra-proporcion {
  display: flex;
  height: 10px;
  border-radius: 5px;
  overflow: hidden;
  margin-top: 14px;
  background: var(--surface-3);
}
.parte-corriente { background: var(--s1); }
.parte-arrastre { background: var(--s2); }

.cadena { margin-top: 16px; }
.cadena h3 { color: var(--ink-2); }
```

- [ ] **Step 4: Montar la sección en `Aplicacion.jsx`**

Agregar el import:

```jsx
import { CicloRevisiones } from "../secciones/CicloRevisiones.jsx";
import "../secciones/ciclo.css";
```

y reemplazar `<Marcador seccion={seccion} />` por:

```jsx
{seccion === "revisiones" ? <CicloRevisiones /> : <Marcador seccion={seccion} />}
```

- [ ] **Step 5: Verificar en el navegador**

Run desde `frontend/`: `npm run dev`, con el backend corriendo.

Abrir la sección "Ciclo y revisiones" y comprobar:
1. Con período 138 y sin empresa: se ven el impacto y el calendario, y la cascada invita a elegir empresa.
2. El arrastre muestra un valor **negativo** cercano a `-S/ 4,515,658.58`. Si mostrara `+S/ 77,055,107.44`, el backend está desactualizado.
3. Al elegir "Transmisora Titicaca" y período 132, la cascada muestra LVTA con cuatro revisiones y LVTP con dos, cada una con su propio ajuste.
4. Ningún ajuste de LVTA supera el 10%.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/api/ frontend/src/secciones/CicloRevisiones.jsx frontend/src/secciones/ciclo.css frontend/src/app/Aplicacion.jsx
git commit -m "feat: seccion de ciclo y revisiones

Consume los tres endpoints de trazabilidad que el plan anterior construyo y
que hasta ahora no veia nadie. Es la respuesta al problema declarado en el
README: que cambio entre una revision y la siguiente, cuando, y cuanto de lo
que se publica cada mes son recalculos de meses anteriores."
```

---

### Task 6: APIs y descargas

**Files:**
- Create: `frontend/src/lib/exportar.js`
- Test: `frontend/src/lib/exportar.test.js`
- Create: `frontend/src/secciones/ApisDescargas.jsx`
- Create: `frontend/src/secciones/apis.css`
- Modify: `frontend/src/app/Aplicacion.jsx`

**Interfaces:**
- Consumes: `cliente`, `API_URL`, `useSeleccion()`.
- Produces:
  - `aCSV(filas: object[]) -> string`
  - `descargar(nombreArchivo: string, contenido: string, tipoMime: string) -> void`
  - `CATALOGO: Array<{ grupo, ruta, metodo, descripcion, parametros, ejemplo }>`

- [ ] **Step 1: Escribir el test que falla**

`frontend/src/lib/exportar.test.js`:

```js
import { describe, expect, it } from "vitest";

import { aCSV } from "./exportar.js";

describe("aCSV", () => {
  it("usa las claves de la primera fila como cabecera", () => {
    const csv = aCSV([{ proceso: "LVTA", monto: 100 }]);

    expect(csv.split("\n")[0]).toBe("proceso,monto");
  });

  it("escapa comas y comillas para que no rompan la columna", () => {
    const csv = aCSV([{ nombre: 'Generadora "Andina", S.A.' }]);

    expect(csv.split("\n")[1]).toBe('"Generadora ""Andina"", S.A."');
  });

  it("convierte null y undefined en celda vacia", () => {
    const csv = aCSV([{ a: null, b: undefined, c: 0 }]);

    expect(csv.split("\n")[1]).toBe(",,0");
  });

  it("devuelve cadena vacia si no hay filas", () => {
    expect(aCSV([])).toBe("");
  });
});
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run desde `frontend/`: `npm test`
Expected: FAIL, no existe `exportar.js`.

- [ ] **Step 3: Escribir `exportar.js`**

```js
function celda(valor) {
  if (valor === null || valor === undefined) return "";

  const texto = String(valor);

  // Una coma, una comilla o un salto de linea romperian la columna.
  if (/[",\n]/.test(texto)) {
    return `"${texto.replace(/"/g, '""')}"`;
  }

  return texto;
}

export function aCSV(filas) {
  if (!filas || filas.length === 0) return "";

  const columnas = Object.keys(filas[0]);
  const cabecera = columnas.join(",");
  const cuerpo = filas.map((fila) => columnas.map((c) => celda(fila[c])).join(","));

  return [cabecera, ...cuerpo].join("\n");
}

export function descargar(nombreArchivo, contenido, tipoMime) {
  // BOM para que Excel abra el CSV con los acentos correctos.
  const bom = tipoMime.startsWith("text/csv") ? "﻿" : "";
  const blob = new Blob([bom + contenido], { type: `${tipoMime};charset=utf-8` });
  const url = URL.createObjectURL(blob);

  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  document.body.removeChild(enlace);

  URL.revokeObjectURL(url);
}
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run desde `frontend/`: `npm test`
Expected: PASS, los 19 (15 de Task 2 más 4 nuevos).

- [ ] **Step 5: Escribir la sección**

`frontend/src/secciones/ApisDescargas.jsx`:

```jsx
import { useState } from "react";

import { API_URL, cliente } from "../api/cliente.js";
import { EstadoCarga } from "../componentes/EstadoCarga.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { aCSV, descargar } from "../lib/exportar.js";
import { useSeleccion } from "../app/contexto.jsx";

const CATALOGO = [
  {
    grupo: "Catalogos",
    endpoints: [
      { ruta: "/periodos", descripcion: "Los 20 periodos disponibles, con su estado y revision vigente.", parametros: [] },
      { ruta: "/empresas", descripcion: "Las 131 empresas con su alias visible.", parametros: [] },
    ],
  },
  {
    grupo: "Panorama",
    endpoints: [
      { ruta: "/radar/{pericodi}", descripcion: "Variaciones del periodo contra el anterior, por empresa.", parametros: ["pericodi"] },
    ],
  },
  {
    grupo: "Trazabilidad de revisiones",
    endpoints: [
      { ruta: "/revisiones/calendario/{pericodi}", descripcion: "Que liquidaciones salen en la publicacion de ese mes.", parametros: ["pericodi"] },
      { ruta: "/revisiones/cascada/{empresa_id}/{pericodi}", descripcion: "Cadena R0 a R4 de un mes, separada por proceso, con el ajuste de cada salto.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/revisiones/impacto/{pericodi}", descripcion: "Cuanto de la publicacion es del mes y cuanto viene arrastrado.", parametros: ["pericodi"] },
    ],
  },
  {
    grupo: "Analisis por empresa",
    endpoints: [
      { ruta: "/agente/resumen/{empresa_id}/{pericodi}", descripcion: "Resultado del periodo, variacion y principales movimientos.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/cambios/{empresa_id}/{pericodi}", descripcion: "Que cambio respecto del periodo anterior, por proceso.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/causas/{empresa_id}/{pericodi}", descripcion: "Descomposicion de la variacion en sus causas.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/trazabilidad/{empresa_id}/{pericodi}", descripcion: "Del monto al proceso y del proceso a su fuente.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/integridad/{empresa_id}/{pericodi}", descripcion: "Reglas de validacion ejecutadas y su resultado.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/contexto/{empresa_id}/{pericodi}", descripcion: "Energia, mercado y operacion del periodo, para contexto.", parametros: ["empresa_id", "pericodi"] },
      { ruta: "/agente/cierre/{empresa_id}/{pericodi}", descripcion: "Si la liquidacion esta lista para cerrar.", parametros: ["empresa_id", "pericodi"] },
    ],
  },
  {
    grupo: "Servicio",
    endpoints: [
      { ruta: "/health", descripcion: "Estado del servicio.", parametros: [] },
      { ruta: "/docs", descripcion: "Documentacion interactiva generada por FastAPI.", parametros: [] },
    ],
  },
];

function resolverRuta(ruta, { empresa, periodo }) {
  return ruta
    .replace("{empresa_id}", empresa ?? "EMPRESA_001")
    .replace("{pericodi}", periodo ?? 137);
}

function FichaEndpoint({ endpoint, contexto }) {
  const [respuesta, setRespuesta] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  const rutaResuelta = resolverRuta(endpoint.ruta, contexto);

  async function probar() {
    setCargando(true);
    setError(null);

    try {
      const { data } = await cliente.get(rutaResuelta);
      setRespuesta(data);
    } catch (e) {
      setError(e.response?.status ? `HTTP ${e.response.status}` : e.message);
    } finally {
      setCargando(false);
    }
  }

  function bajarJSON() {
    const nombre = rutaResuelta.replace(/^\//, "").replace(/\//g, "_");
    descargar(`${nombre}.json`, JSON.stringify(respuesta, null, 2), "application/json");
  }

  function bajarCSV() {
    // Se busca el primer arreglo de objetos dentro de la respuesta:
    // algunos endpoints devuelven la lista en la raiz y otros anidada.
    const filas = Array.isArray(respuesta)
      ? respuesta
      : Object.values(respuesta ?? {}).find(
          (v) => Array.isArray(v) && typeof v[0] === "object",
        );

    if (!filas) {
      setError("esta respuesta no es tabular; usa la descarga JSON");
      return;
    }

    const nombre = rutaResuelta.replace(/^\//, "").replace(/\//g, "_");
    descargar(`${nombre}.csv`, aCSV(filas), "text/csv");
  }

  return (
    <article className="ficha-endpoint">
      <header>
        <code className="metodo">GET</code>
        <code className="ruta">{endpoint.ruta}</code>
      </header>

      <p className="descripcion">{endpoint.descripcion}</p>

      {endpoint.parametros.length > 0 && (
        <p className="nota">
          Parametros: {endpoint.parametros.join(", ")} — se completan con tu
          seleccion de la barra lateral.
        </p>
      )}

      <p className="url-resuelta cifra">{API_URL}{rutaResuelta}</p>

      <div className="acciones-endpoint">
        <button type="button" className="boton" onClick={probar} disabled={cargando}>
          {cargando ? "Consultando…" : "Probar"}
        </button>

        {respuesta && (
          <>
            <button type="button" className="boton-secundario" onClick={bajarJSON}>
              Descargar JSON
            </button>
            <button type="button" className="boton-secundario" onClick={bajarCSV}>
              Descargar CSV
            </button>
          </>
        )}
      </div>

      {error && <p className="estado-error">{error}</p>}

      {respuesta && (
        <details className="respuesta">
          <summary>Respuesta</summary>
          <pre>{JSON.stringify(respuesta, null, 2).slice(0, 4000)}</pre>
        </details>
      )}
    </article>
  );
}

export function ApisDescargas() {
  const { periodo, empresa, empresas } = useSeleccion();

  const alias = empresas.find((e) => e.empresa_id === empresa)?.alias;

  return (
    <div className="rejilla">
      <Tarjeta etiqueta="Como funciona" titulo="Consulta y exporta los datos">
        <p className="nota">
          Todos los endpoints son <code>GET</code> y devuelven JSON. Las rutas
          se completan con lo que elijas en la barra lateral: hoy periodo{" "}
          <strong>{periodo ?? "—"}</strong> y empresa{" "}
          <strong>{alias ?? "ninguna (se usa una de ejemplo)"}</strong>.
        </p>
        <p className="nota">
          La descarga CSV busca la primera lista de registros dentro de la
          respuesta. Cuando la respuesta no es tabular, usa JSON.
        </p>
        <p className="nota">
          Base: <code className="cifra">{API_URL}</code> · Documentacion
          interactiva en <code className="cifra">{API_URL}/docs</code>
        </p>
      </Tarjeta>

      {CATALOGO.map((grupo) => (
        <Tarjeta key={grupo.grupo} etiqueta="Grupo" titulo={grupo.grupo}>
          <div className="lista-endpoints">
            {grupo.endpoints.map((e) => (
              <FichaEndpoint
                key={e.ruta}
                endpoint={e}
                contexto={{ empresa, periodo }}
              />
            ))}
          </div>
        </Tarjeta>
      ))}
    </div>
  );
}
```

- [ ] **Step 6: Crear `apis.css`**

```css
.lista-endpoints { display: flex; flex-direction: column; gap: 12px; }

.ficha-endpoint {
  border: 1px solid var(--border);
  border-radius: 8px;
  padding: 12px;
  background: var(--surface-2);
}
.ficha-endpoint header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }

.metodo {
  background: var(--ok);
  /* Mismo problema que los botones: --ok invierte de verde oscuro a verde
     claro entre modos, asi que el color del texto tiene que invertir con el. */
  color: var(--sobre-accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: .06em;
  border-radius: 4px;
  padding: 2px 6px;
}
.ruta { font-family: var(--fuente-mono); font-size: 13px; color: var(--ink); }
.descripcion { margin: 0 0 6px; font-size: 13px; color: var(--ink-2); }

.url-resuelta {
  display: block;
  font-size: 11px;
  color: var(--ink-muted);
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 8px;
  margin: 8px 0;
  overflow-x: auto;
  white-space: nowrap;
}

.acciones-endpoint { display: flex; gap: 8px; flex-wrap: wrap; }

.respuesta { margin-top: 10px; }
.respuesta summary { cursor: pointer; font-size: 12px; color: var(--ink-muted); }
.respuesta pre {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 10px;
  font-family: var(--fuente-mono);
  font-size: 11px;
  max-height: 320px;
  overflow: auto;
}
```

- [ ] **Step 7: Montar la sección**

En `Aplicacion.jsx`, agregar los imports y extender el ruteo:

```jsx
import { ApisDescargas } from "../secciones/ApisDescargas.jsx";
import "../secciones/apis.css";
```

```jsx
{seccion === "revisiones" && <CicloRevisiones />}
{seccion === "apis" && <ApisDescargas />}
{!["revisiones", "apis"].includes(seccion) && <Marcador seccion={seccion} />}
```

- [ ] **Step 8: Verificar en el navegador**

Run desde `frontend/`: `npm run dev`, con el backend corriendo.

En la sección "APIs y descargas":
1. Se ven los cinco grupos con sus endpoints.
2. La URL resuelta refleja el período y la empresa de la barra lateral.
3. "Probar" en `/periodos` devuelve 20 períodos.
4. "Descargar CSV" en `/periodos` baja un archivo que Excel abre con los acentos correctos.
5. "Descargar JSON" funciona en cualquier endpoint.
6. Un endpoint sin datos muestra el código HTTP, no una pantalla rota.

- [ ] **Step 9: Commit**

```bash
git add frontend/src/lib/exportar.js frontend/src/lib/exportar.test.js frontend/src/secciones/ApisDescargas.jsx frontend/src/secciones/apis.css frontend/src/app/Aplicacion.jsx
git commit -m "feat: seccion de APIs y descargas

Catalogo de los endpoints con descripcion, probador en vivo y exportacion a
CSV o JSON. Las rutas se completan con la seleccion global, asi que probar un
endpoint no obliga a escribir ids a mano."
```

---

### Task 7: Mi empresa y Panorama sobre el flujo existente

Aquí se conserva lo que ya funciona. `App.jsx` tiene 7.912 líneas de lógica causal que pasó revisión; reescribirla sería tirar trabajo bueno.

**Files:**
- Rename: `frontend/src/App.jsx` → `frontend/src/LegacyApp.jsx`
- Modify: `frontend/src/LegacyApp.jsx` (una prop nueva y el salto de la pantalla de selección)
- Create: `frontend/src/secciones/MiEmpresa.jsx`
- Create: `frontend/src/secciones/Panorama.jsx`
- Modify: `frontend/src/app/Aplicacion.jsx`

**Interfaces:**
- Consumes: `useSeleccion()`.
- Produces: `<MiEmpresa/>`, `<Panorama/>`.

- [ ] **Step 1: Renombrar el archivo**

```bash
cd frontend
git mv src/App.jsx src/LegacyApp.jsx
```

- [ ] **Step 2: Aceptar el modo y la selección por prop**

En `LegacyApp.jsx`, cambiar la firma del componente y su export. Hoy es:

```jsx
function App() {
```

Pasa a ser:

```jsx
function LegacyApp({ modoInicial = null, empresaInicial = null, periodoInicial = null }) {
```

Y al final del archivo, cambiar:

```jsx
export default App;
```

por:

```jsx
export default LegacyApp;
```

- [ ] **Step 3: Inicializar el estado desde las props**

Localizar las declaraciones de estado (alrededor de las líneas 99-126) y cambiar **solo** estas tres, dejando el resto igual:

```jsx
const [modoActual, setModoActual] = useState(modoInicial);
const [empresaAgente, setEmpresaAgente] = useState(empresaInicial);
const [fecha, setFecha] = useState(periodoInicial ?? "");
```

Después, agregar un efecto que mantenga la sincronía cuando el usuario cambia la selección global. Ponerlo junto a los demás `useEffect`, después del que carga los períodos:

```jsx
// La seleccion vive ahora en la barra lateral. Cuando cambia, este
// componente la adopta sin que el usuario tenga que volver a una
// pantalla de seleccion propia.
useEffect(() => {
    if (empresaInicial !== null) setEmpresaAgente(empresaInicial);
}, [empresaInicial]);

useEffect(() => {
    if (periodoInicial !== null) setFecha(periodoInicial);
}, [periodoInicial]);
```

- [ ] **Step 4: Saltar la pantalla de selección propia**

`LegacyApp` tiene su propia pantalla de inicio (el bloque `modoActual === null`). Con la cáscara nueva esa pantalla sobra: la selección está en la barra lateral.

Localizar el bloque que empieza con la pregunta "¿Cómo quieres investigar?" y envolverlo en una condición que lo omita cuando llega un modo por prop:

```jsx
{modoInicial === null && modoActual === null && (
    /* ...la pantalla de seleccion existente, sin cambios... */
)}
```

No borres ese bloque: `LegacyApp` debe seguir funcionando por sí solo si alguien lo monta sin props.

- [ ] **Step 5: Acotar los selectores globales de `App.css`**

> **Este paso va antes de importar `App.css`, y el orden importa.**

`frontend/src/App.css` tiene **5.536 líneas** y cinco selectores **globales**
que pelearían con el sistema de diseño en toda la aplicación, no solo dentro
del componente legado:

| Línea | Selector |
|---|---|
| 1 | `*` |
| 5 | `body` |
| 79 | `button` |
| 89 | `button:hover` |
| 174 | `table` |

Acotarlos bajo una clase `.legacy`. Son cinco ediciones, no 5.536:

```css
/* antes */            /* despues */
*          { … }       .legacy *          { … }
body       { … }       .legacy            { … }
button     { … }       .legacy button     { … }
button:hover { … }     .legacy button:hover { … }
table      { … }       .legacy table      { … }
```

Nota que `body` pasa a `.legacy` a secas, no a `.legacy body`: lo que antes
aplicaba al documento entero ahora aplica al contenedor del componente.

Después, envolver el árbol que `LegacyApp` devuelve. Localizar su `return (` de
nivel superior y añadir el contenedor:

```jsx
return (
    <div className="legacy">
        {/* ...todo el arbol existente, sin cambios... */}
    </div>
);
```

Verificar que no quedó ningún selector global suelto:

```bash
grep -nE "^(\*|body|button|table|html|a|input|select)\s*[,{:]" frontend/src/App.css
```

Expected: sin resultados.

- [ ] **Step 6: Crear las dos secciones**

`frontend/src/secciones/MiEmpresa.jsx`:

```jsx
import LegacyApp from "../LegacyApp.jsx";
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { useSeleccion } from "../app/contexto.jsx";

export function MiEmpresa() {
  const { empresa, periodo } = useSeleccion();

  if (!empresa) {
    return (
      <Tarjeta etiqueta="Modo agente" titulo="Elige una empresa">
        <p className="nota">
          Busca tu empresa en la barra lateral para ver que cambio en su
          liquidacion, por que cambio, y si puede avanzar al cierre.
        </p>
      </Tarjeta>
    );
  }

  return (
    <LegacyApp
      key={`agente-${empresa}-${periodo}`}
      modoInicial="agente"
      empresaInicial={empresa}
      periodoInicial={periodo}
    />
  );
}
```

`frontend/src/secciones/Panorama.jsx`:

```jsx
import LegacyApp from "../LegacyApp.jsx";
import { useSeleccion } from "../app/contexto.jsx";

export function Panorama() {
  const { periodo } = useSeleccion();

  return (
    <LegacyApp
      key={`analista-${periodo}`}
      modoInicial="analista"
      periodoInicial={periodo}
    />
  );
}
```

> El `key` fuerza a React a remontar el componente cuando cambia la selección. `LegacyApp` guarda mucho estado interno derivado de la empresa y el período; remontar es más seguro y más simple que intentar sincronizar cada pieza.

- [ ] **Step 7: Montar las secciones**

En `Aplicacion.jsx`:

```jsx
import { MiEmpresa } from "../secciones/MiEmpresa.jsx";
import { Panorama } from "../secciones/Panorama.jsx";
import "../App.css";
```

```jsx
{seccion === "panorama" && <Panorama />}
{seccion === "mi-empresa" && <MiEmpresa />}
{seccion === "revisiones" && <CicloRevisiones />}
{seccion === "apis" && <ApisDescargas />}
{seccion === "calidad" && <Marcador seccion={seccion} />}
```

- [ ] **Step 8: Verificar en el navegador**

Run desde `frontend/`: `npm run build` y `npm run dev`.

1. "Panorama" muestra el radar de variaciones del período elegido.
2. "Mi empresa" sin empresa seleccionada invita a elegir una.
3. Al buscar "Eólica Santa" en la barra lateral y entrar a "Mi empresa", carga su análisis directamente, **sin pasar por una pantalla de selección**.
4. Cambiar de período en la barra lateral recarga el análisis.
5. Cambiar de empresa recarga el análisis de la nueva.

- [ ] **Step 9: Commit**

```bash
git add -A frontend/src
git commit -m "feat: Mi empresa y Panorama sobre el flujo existente

App.jsx pasa a LegacyApp.jsx y recibe el modo y la seleccion por prop, asi
que la cascara nueva lo monta directamente sin su pantalla de seleccion
propia. Se conservan las 7.912 lineas de logica causal que ya funcionaban;
lo que cambia es como se llega a ellas."
```

---

### Task 8: Calidad y trazabilidad

**Files:**
- Create: `frontend/src/secciones/Calidad.jsx`
- Modify: `frontend/src/app/Aplicacion.jsx`

**Interfaces:**
- Consumes: `useSeleccion()`, `<Tarjeta>`.
- Produces: `<Calidad/>`.

- [ ] **Step 1: Escribir la sección**

Esta sección tiene una función poco habitual: **declarar los límites del dato**. Es lo que separa un producto creíble de uno que promete más de lo que puede sostener.

```jsx
import { Tarjeta } from "../componentes/Tarjeta.jsx";
import { useSeleccion } from "../app/contexto.jsx";

const REGLAS = [
  {
    codigo: "REGLA-LVTA-001",
    nombre: "Energia Activa",
    que: "El resultado de Energia Activa debe cuadrar con el soporte de transferencias por empresa.",
  },
  {
    codigo: "REGLA-LSCIO-001",
    nombre: "Reconstruccion LSCIO",
    que: "La suma del desglose por mecanismo debe igualar el total de transferencias LSCIO.",
  },
  {
    codigo: "REGLA-POTENCIA-001",
    nombre: "Trazabilidad Potencia",
    que: "El resultado de Potencia debe reconstruirse desde su desglose por valorizacion.",
  },
];

const LIMITES = [
  {
    titulo: "La cadena de calculo no es reproducible desde estos datos",
    detalle:
      "Se verifico sobre los datos originales: los retiros cubren 12 de 71 empresas, el costo marginal cubre 248 de 828 barras, y la Energia Activa viene como una sola fila sin desglosar. Los datasets son resultados de consultas a produccion, no insumos de un modelo recalculable. Las validaciones comprueban consistencia interna, no reconstruyen la formula regulatoria.",
  },
  {
    titulo: "Los meses de 2025 son sinteticos",
    detalle:
      "Fueron generados para dar profundidad interanual, calibrados sobre el comportamiento de los meses reales. Sirven para demostrar tendencias y estacionalidad; no para afirmar hechos sobre empresas concretas ni contrastar cifras publicadas. Cada mes sintetico se marca en pantalla.",
  },
  {
    titulo: "Las empresas estan anonimizadas",
    detalle:
      "El identificador real fue reemplazado por uno ficticio, estable entre todos los datasets. El nombre que ves es un alias generado, no la razon social. Si una empresa aparece en dos vistas distintas, es la misma entidad — pero no es posible saber cual.",
  },
  {
    titulo: "LSCIO tiene meses sin carga",
    detalle:
      "Es carga manual mes a mes del equipo de COES. Los meses vacios no son un error del dato: reflejan como es la operacion real.",
  },
  {
    titulo: "Un monto restatado no es un ajuste",
    detalle:
      "Cada revision restata el mes completo, asi que su monto ya incluye todo lo publicado antes. Sumar los montos de varias revisiones del mismo mes seria doble contabilidad. Por eso el ajuste se calcula siempre como diferencia contra la revision anterior.",
  },
];

export function Calidad() {
  const { periodos, periodo } = useSeleccion();
  const p = periodos.find((x) => x.pericodi === periodo);

  return (
    <div className="rejilla">
      <Tarjeta etiqueta="Periodo seleccionado" titulo={p?.perinombre ?? "—"}>
        <table className="tabla">
          <tbody>
            <tr><td>Estado</td><td className="num">{p?.estado ?? "—"}</td></tr>
            <tr><td>Revision vigente</td><td className="num">{p?.version_vigente ?? "—"}</td></tr>
            <tr><td>Origen del dato</td><td className="num">{p?.origen === "sintetico" ? "Sintetico" : "Real"}</td></tr>
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta
        etiqueta="Validaciones"
        titulo="Reglas de integridad que se ejecutan"
      >
        <p className="nota">
          Se ejecutan por empresa y periodo en la seccion Mi empresa. Comprueban
          que los numeros cuadren entre el resultado y su soporte.
        </p>
        <table className="tabla">
          <thead>
            <tr><th>Codigo</th><th>Valida</th><th>Que comprueba</th></tr>
          </thead>
          <tbody>
            {REGLAS.map((r) => (
              <tr key={r.codigo}>
                <td className="cifra">{r.codigo}</td>
                <td>{r.nombre}</td>
                <td>{r.que}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Tarjeta>

      <Tarjeta
        etiqueta="Honestidad del dato"
        titulo="Que debes saber antes de usar estas cifras"
      >
        <p className="nota">
          Declarar los limites no debilita el analisis: lo hace defendible.
        </p>
        {LIMITES.map((l) => (
          <details key={l.titulo} className="limite">
            <summary>{l.titulo}</summary>
            <p>{l.detalle}</p>
          </details>
        ))}
      </Tarjeta>
    </div>
  );
}
```

- [ ] **Step 2: Añadir el estilo de los desplegables**

Agregar al final de `frontend/src/componentes/componentes.css`:

```css
.limite { border-top: 1px solid var(--grid); padding: 9px 0; }
.limite summary { cursor: pointer; font-weight: 600; font-size: 13px; }
.limite p { margin: 7px 0 0; font-size: 12px; color: var(--ink-2); line-height: 1.6; }
```

- [ ] **Step 3: Montar la sección**

En `Aplicacion.jsx`:

```jsx
import { Calidad } from "../secciones/Calidad.jsx";
```

```jsx
{seccion === "calidad" && <Calidad />}
```

Ya no queda ninguna sección disponible sin componente: `Marcador` puede eliminarse junto con su uso.

- [ ] **Step 4: Verificar en el navegador**

Run desde `frontend/`: `npm run dev`
1. La sección muestra el estado y la revisión vigente del período elegido.
2. Las tres reglas aparecen con su descripción.
3. Los cinco límites se despliegan al hacer clic.
4. Elegir un mes de 2025 cambia "Origen del dato" a "Sintetico".

- [ ] **Step 5: Commit**

```bash
git add frontend/src/secciones/Calidad.jsx frontend/src/componentes/componentes.css frontend/src/app/Aplicacion.jsx
git commit -m "feat: seccion de calidad y trazabilidad

Declara las reglas de integridad y, sobre todo, los limites del dato: que la
cadena de calculo no es reproducible desde el paquete, que 2025 es sintetico,
que las empresas estan anonimizadas, y por que un monto restatado no se suma.
Declarar los limites hace el analisis defendible."
```

---

### Task 9: Cierre — verificación completa y limpieza

**Files:**
- Modify: `frontend/src/app/Aplicacion.jsx` (quitar `Marcador`)
- Modify: `README.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: nada nuevo.

- [ ] **Step 1: Correr todas las verificaciones**

Desde `frontend/`:

```bash
npm test
npm run lint
npm run build
```

Expected: 19 tests en verde, lint sin errores, build exitoso.

- [ ] **Step 2: Recorrido completo en el navegador**

Con backend y frontend corriendo, verificar cada sección con **período 137 (2026.Junio, Cerrado)** y empresa **"Transmisora Titicaca"**:

| Sección | Qué debe verse |
|---|---|
| Panorama | Radar de variaciones del período |
| Mi empresa | Análisis de la empresa, sin pantalla de selección intermedia |
| Ciclo y revisiones | Impacto, calendario y cascada por proceso |
| Calidad | Estado del período, tres reglas, cinco límites |
| APIs y descargas | Cinco grupos; "Probar" y ambas descargas funcionan |
| Procesos / Red | Atenuadas, marcadas "Proximo", no clicables |

Comprobar además:
1. El modo oscuro se aplica a todas las secciones y sobrevive a recargar.
2. Cambiar de empresa en la barra lateral se refleja en Mi empresa y en Ciclo y revisiones sin recargar la página.
3. Un mes de 2025 muestra el aviso de sintético.
4. La consola del navegador no tiene errores.

- [ ] **Step 3: Actualizar el README**

En la sección de estructura, reemplazar la descripción del frontend por:

```
├── frontend/         aplicación React + Vite
│   └── src/
│       ├── app/          cáscara: navegación, selección global, tema
│       ├── secciones/    una por entrada del menú
│       ├── componentes/  tarjetas, variaciones, estados de carga
│       ├── lib/          formato de cifras y semántica de variaciones
│       ├── api/          cliente HTTP por dominio
│       └── LegacyApp.jsx flujo causal A1→A7, montado dentro de las secciones
```

Y agregar bajo la sección de Pruebas:

```bash
cd frontend
npm test      # tests de formato, variaciones y exportación
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/Aplicacion.jsx README.md
git commit -m "chore: cerrar la reconstruccion del frontend

Quita el marcador de secciones en construccion y documenta la estructura
nueva y los tests del frontend."
```

---

---

### Task 10: Auditoría de accesibilidad y pulido

Es un portal para el sector eléctrico peruano. Esta tarea es la que decide si se siente institucional o improvisado.

**Files:**
- Modify: cualquiera de `frontend/src/` según lo que encuentre la auditoría
- Create: `docs/accesibilidad.md`

**Interfaces:**
- Consumes: todo lo anterior.
- Produces: `docs/accesibilidad.md` con el resultado de la auditoría.

- [ ] **Step 1: Auditar el contraste de cada combinación en uso**

Recorrer la app en **modo claro y en modo oscuro** y medir el contraste real de cada par texto/fondo con las herramientas de desarrollo del navegador (pestaña Elements → panel de color, que muestra el ratio).

Los pares a verificar, como mínimo:

| Texto | Sobre | Mínimo exigido |
|---|---|---|
| `--ink` | `--bg` y `--surface` | 4.5:1 |
| `--ink-2` | `--surface` y `--surface-2` | 4.5:1 |
| `--ink-muted` | `--surface` | 4.5:1 |
| blanco | `--accent` (botones) | 4.5:1 |
| `--warn`, `--crit` | `--surface` | 4.5:1 |
| `--accent` (borde de foco) | `--surface` | 3:1 |

Anotar cada ratio medido. **Donde no llegue, ajustar el token de texto — nunca el de identidad.** El degradado y los colores de marca vienen de las presentaciones oficiales de HackaCOES y no se tocan; lo que se ajusta es el gris del texto secundario, que es una decisión de este proyecto.

- [ ] **Step 2: Recorrer la aplicación completa solo con teclado**

Desconectar el ratón. Desde la carga de la página:

1. `Tab` — el primer foco debe ser "Saltar al contenido".
2. `Enter` en ese enlace — el foco salta al área de contenido.
3. `Tab` hasta el menú — cada sección se alcanza y `Enter` la abre.
4. Las secciones marcadas "Proximo" se saltan (están `disabled`).
5. `Tab` hasta los selectores — el de empresa acepta escritura y el desplegable se navega con flechas.
6. En "APIs y descargas": llegar a "Probar" y a las descargas, y activarlas con `Enter`.
7. En "Calidad": abrir y cerrar los desplegables con `Enter`.

**En cada parada el foco debe ser visible.** Anotar cualquier punto donde se pierda, quede atrapado, o el orden sea ilógico.

- [ ] **Step 3: Verificar los nombres accesibles**

En la consola del navegador, listar los controles sin nombre accesible:

```js
[...document.querySelectorAll("button, a, input, select")]
  .filter((el) => {
    const nombre =
      el.getAttribute("aria-label") ||
      el.textContent.trim() ||
      (el.labels && el.labels.length ? el.labels[0].textContent.trim() : "");
    return !nombre;
  })
  .map((el) => el.outerHTML.slice(0, 120));
```

Expected: arreglo vacío. Cada resultado es un control que un lector de pantalla anunciaría como "botón" a secas.

- [ ] **Step 4: Verificar que ninguna información dependa solo del color**

Recorrer la app con el simulador de daltonismo del navegador (DevTools → Rendering → Emulate vision deficiencies), probando **protanopia**, **deuteranopia** y **acromatopsia**.

En cada una, comprobar que sigue siendo posible:
- Distinguir la sección activa del menú (tiene barra lateral y negrita, no solo color).
- Leer si una variación es fuerte o de revisar (tiene sello de texto, no solo color).
- Distinguir un mes sintético (tiene etiqueta de texto y borde punteado).
- Ver qué parte de la barra de impacto es corriente y cuál arrastre (**si no se distingue, agregar un patrón o etiquetas directas**).

- [ ] **Step 5: Revisar la jerarquía de encabezados**

```js
[...document.querySelectorAll("h1,h2,h3,h4")].map((h) => `${h.tagName} ${h.textContent.trim().slice(0,60)}`)
```

Expected: **un solo `H1` por pantalla** (el título de la sección) y ningún salto de nivel (`H1` → `H3` sin `H2` en medio). Un lector de pantalla usa esta jerarquía para navegar.

- [ ] **Step 6: Pulir los estados vacíos**

Recorrer cada sección **sin empresa seleccionada** y con un **período abierto** (139, sin reportes intermedios). Ninguna pantalla debe quedar en blanco ni mostrar un error técnico.

Cada estado vacío debe decir tres cosas: qué falta, por qué, y qué hacer. Por ejemplo, en lugar de "No hay datos":

> **Este período aún no tiene reportes intermedios.** Agosto 2026 está abierto: sus cuadros de energía y costo marginal se publican al cerrar el mes. Elige un período cerrado para ver el contexto completo.

Ajustar los mensajes de `EstadoCarga` y de cada sección con ese criterio.

- [ ] **Step 7: Verificar en pantalla angosta**

Reducir la ventana a 390px de ancho (tamaño de teléfono). Comprobar que no hay desplazamiento horizontal, que el menú sigue siendo utilizable, y que las tablas se desplazan dentro de su contenedor sin romper el ancho de la página.

Si alguna tabla desborda, envolverla:

```css
.tabla-scroll { overflow-x: auto; -webkit-overflow-scrolling: touch; }
```

- [ ] **Step 8: Escribir `docs/accesibilidad.md`**

Documentar lo verificado, con los ratios de contraste reales medidos, el resultado del recorrido por teclado, y cualquier decisión tomada. Incluir lo que **no** se cubrió, para que nadie asuma de más.

Es un documento corto y honesto, no un certificado.

- [ ] **Step 9: Correr todas las verificaciones**

```bash
cd frontend
npm test
npm run lint
npm run build
```

Expected: 19 tests en verde, lint sin errores, build exitoso.

- [ ] **Step 10: Commit**

```bash
git add -A frontend/src docs/accesibilidad.md
git commit -m "feat: auditoria de accesibilidad y pulido

Contraste medido en claro y oscuro, recorrido completo por teclado, nombres
accesibles verificados, y comprobacion con tres tipos de daltonismo. Los
estados vacios ahora dicen que falta, por que y que hacer, en vez de 'No hay
datos'."
```

---

## Verificación final del plan

| Comando | Resultado esperado |
|---|---|
| `cd frontend && npm test` | 19 passed |
| `cd frontend && npm run lint` | sin errores |
| `cd frontend && npm run build` | build exitoso |
| Navegador | 5 secciones funcionando, 2 marcadas como próximas |
| Recorrido por teclado | Completo, con foco visible en cada parada |
| Contraste | 4.5:1 en texto, medido en claro y oscuro |
| `docs/accesibilidad.md` | Existe, con los ratios reales y lo no cubierto |

## Fuera de alcance

**Procesos** y **Red y precios** necesitan endpoints que no existen: exponer `fact_desglose`, `fact_evolucion`, `agg_cmg_diario` y `agg_perfil_intradia`. Es el hallazgo de "ocho tablas curadas sin lector" de la revisión final del plan anterior. Ese trabajo empieza en el backend y merece su propio plan.

**Los renderers SVG del dashboard HTML** (~60 funciones) no se portan en este plan. Las secciones que los necesitan son justamente las dos que quedan fuera.

**`LegacyApp.jsx` sigue siendo un archivo de 7.912 líneas** en una sola función. Este plan lo encapsula y lo hace alcanzable desde una navegación clara, pero no lo descompone. Hacerlo es un tercer plan, y conviene hacerlo cuando las secciones nuevas hayan estabilizado los componentes compartidos que ese código podría reusar.

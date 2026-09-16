# Auditoría de accesibilidad — Task 10

Documento corto y honesto. No es un certificado: dice qué se verificó, cómo,
y qué quedó sin cubrir para que nadie asuma de más.

**Limitación de entorno:** la extensión de Chrome para uso de la IA no
estuvo disponible durante esta tarea (tampoco en las nueve anteriores). Todo
lo que requiere un navegador real — recorrido por teclado, simulador de
daltonismo, medir en pantalla angosta con DevTools — **no se ejecutó**. Lo
que sigue distingue en cada sección qué se verificó por lectura de código o
cálculo, y qué no.

## 1. Contraste (verificado por cálculo, no por navegador)

Se recalculó el contraste real con la fórmula WCAG (luminancia relativa +
razón `(L1+0.05)/(L2+0.05)`) sobre los valores actuales de
`frontend/src/estilos/tokens.css`, en vez de leerlo del inspector de color
del navegador.

| Par | Claro | Oscuro | Mínimo | Resultado |
|---|---|---|---|---|
| `--ink` / `--bg` | 15.89:1 | 17.28:1 | 4.5:1 | OK |
| `--ink` / `--surface` | 17.39:1 | 15.54:1 | 4.5:1 | OK |
| `--ink-2` / `--surface` | 7.64:1 | 9.41:1 | 4.5:1 | OK |
| `--ink-2` / `--surface-2` | 6.79:1 | 8.40:1 | 4.5:1 | OK |
| `--ink-muted` / `--surface` | 5.45:1 | 5.09:1 | 4.5:1 | OK (ver ajuste) |
| `--ink-muted` / `--bg` | 4.98:1 | 5.66:1 | 4.5:1 | OK (ver ajuste) |
| blanco / `--accent` (botones, claro) | 6.88:1 | — | 4.5:1 | OK |
| `--sobre-accent` / `--accent` (botones, oscuro) | — | 5.88:1 | 4.5:1 | OK |
| `--warn-texto` / `--surface` | 5.28:1 | 10.57:1 | 4.5:1 | OK |
| `--crit` / `--surface` | 4.80:1 | 5.85:1 | 4.5:1 | OK |
| `--good-texto` / `--surface` | 6.44:1 | 7.68:1 | 4.5:1 | OK |
| `--accent` (borde de foco) / `--surface` | 6.88:1 | 5.29:1 | 3:1 | OK |

Hallazgo y ajuste de esta tarea: `--ink-muted` original (`#6B7688`) daba
**4.59:1** sobre `--surface` (raspando el mínimo) y **4.20:1** sobre `--bg`
— y `.estado` (el texto de `EstadoCarga`: cargando/error/vacío) se pinta
directo sobre `--bg`, no dentro de una tarjeta, porque no está envuelto en
`.tarjeta`. Esa combinación no llegaba a 4.5:1. Se oscureció el token a
`#606A7D` (modo claro únicamente; el valor de modo oscuro `#7E8CA3` ya
cumplía). Sigue siendo un gris secundario discreto, ahora con margen real
en las dos superficies donde aparece.

`--warn` y `--good` en su tono de marca (no `-texto`) siguen sin cumplir
4.5:1 como texto (1.83:1 y 3.35:1) — por diseño: solo se usan como relleno
o marca visual (mínimo 3:1), nunca como color de texto directo. El texto
usa siempre `--warn-texto` / `--good-texto`. Estos tokens compañeros ya
existían antes de esta tarea; aquí se repitió el cálculo para confirmar que
siguen vigentes con los valores actuales, y no se tocó ningún color de
identidad (paleta y degradado de las presentaciones HackaCOES).

## 2. Recorrido por teclado — NO VERIFICADO

Requiere navegador real (Tab/Enter/flechas) para confirmar orden de foco,
visibilidad del foco en cada parada, y que nada quede atrapado. Sin la
extensión de Chrome no se puede ejecutar. Lo que sí se confirmó leyendo el
código:

- `frontend/src/estilos/base.css` tiene `:focus-visible` global (outline de
  2px con `--accent`) y un enlace "Saltar al contenido" (`.saltar-al-contenido`)
  que es el primer elemento del DOM en `Layout.jsx`.
- Las secciones "Proximo" en `Layout.jsx` usan `disabled`, que las saca del
  orden de tabulación por comportamiento nativo del navegador (no se
  verificó en ejecución, pero es la semántica HTML estándar).
- Los `<select>`/`<input>` de `SeleccionGlobal.jsx` no interceptan teclado;
  dependen del comportamiento nativo del navegador para las flechas.

## 3. Nombres accesibles (verificado leyendo JSX, no con el script de consola)

Revisado: `Layout.jsx`, `SeleccionGlobal.jsx`, `Tarjeta.jsx`,
`EstadoCarga.jsx`, `MarcaSintetico.jsx`, `Variacion.jsx`, y las cinco
secciones (`Panorama.jsx`, `MiEmpresa.jsx`, `CicloRevisiones.jsx`,
`Calidad.jsx`, `ApisDescargas.jsx`). Todos los botones tienen texto visible,
los `<select>`/`<input>` de la barra lateral tienen `<label htmlFor>`, y los
íconos puramente decorativos llevan `aria-hidden="true"`. No se encontraron
controles sin nombre en este perímetro.

**Hallazgo sin corregir, en `LegacyApp.jsx`** (archivo de ~8.000 líneas que
esta tarea tiene instrucción explícita de no tocar salvo un texto puntual,
por el riesgo de modificarlo sin poder probarlo en navegador):

- El `<select>` de "Periodo analizado" (línea ~2071) no tiene `<label
  htmlFor>` ni `aria-label`; solo un `<span>` visual adyacente, que no cuenta
  como nombre accesible para un lector de pantalla.
- El botón para cerrar el chat asistente (`.assistant-chat-close`, línea
  ~7714) solo contiene el carácter "×" como texto — pasa la prueba de "no
  está vacío" pero un lector de pantalla lo anuncia como "×, botón", que es
  ambiguo.

No se corrigieron por estar fuera del texto puntual autorizado en
`LegacyApp.jsx` para esta tarea.

## 4. Daltonismo — NO VERIFICADO

Requiere el simulador de DevTools (protanopia, deuteranopia, acromatopsia).
Sin navegador no se puede confirmar visualmente. Por lectura de código, las
señales que el diseño ya usa además de color son:

- Sección activa del menú: `aria-current="page"` + `font-weight: 600` +
  borde izquierdo (`Layout.jsx` / `layout.css`), no solo el color de fondo.
- Variación fuerte/revisar: sello de texto ("Fuerte"/"Revisar") en
  `Variacion.jsx`, no solo el color.
- Mes sintético: etiqueta de texto "sintetico" + borde punteado en
  `MarcaSintetico.jsx` / `.marca-sintetico` (`border: 1px dashed`), no solo
  color. Ahora, además, se usa en la tabla de calendario del ciclo de
  revisiones (ver sección de correcciones abajo).
- Barra de impacto (corriente/arrastre): tienen etiqueta de texto propia
  ("Mes corriente" / "Ajuste de meses anteriores") junto a la barra, no solo
  el color de relleno.

No se verificó si el contraste entre los colores de esas barras se
distingue igual bajo acromatopsia (escala de grises); solo se confirmó que
cada una tiene una etiqueta de texto que no depende de percibir el color.

## 5. Jerarquía de encabezados (verificado leyendo código)

`Layout.jsx` tiene un único `<h1>` por pantalla (línea 72,
`{seccion?.titulo}`). `Tarjeta.jsx` usa `<h2>` para el título de cada
tarjeta. Dentro de `CicloRevisiones.jsx`, los `<h3>` de cada proceso
(Calendario/Cascada) están anidados dentro de una tarjeta con `<h2>`, así
que la secuencia es H1 → H2 → H3 sin salto.

**Hallazgo sin corregir:** `Panorama.jsx` y `MiEmpresa.jsx` renderizan
`LegacyApp.jsx`, que tiene su **propio** `<h1>` ("COES Liquidaciones 360",
línea ~2054) además del `<h1>` de `Layout.jsx` ("Panorama" / "Mi empresa").
Eso da **dos `<h1>` por pantalla** en esas dos secciones, lo cual viola la
regla de un solo H1. No se corrigió: arreglarlo implica tocar `LegacyApp.jsx`
más allá del texto puntual autorizado para esta tarea, en un archivo que no
se puede probar en navegador en este entorno. Queda documentado para que se
corrija cuando ese archivo se pueda verificar en un navegador real o se
descomponga (fuera de alcance de este plan, según el propio brief).

## 6. Estados vacíos (verificado y ajustado)

`CicloRevisiones.jsx`: un período abierto (sin reportes intermedios) hacía
que el backend devolviera 404, y eso se mostraba con el estilo de **error**
("no se pudo cargar"), en rojo, con un texto técnico ("sin datos para este
periodo"). Se cambió a un estado **vacío** explicativo, sin alarmar:

> Este período aún no tiene revisiones publicadas. Los períodos abiertos
> publican su calendario y cascada al cerrar el mes: elige un período
> cerrado en la barra lateral para ver el ciclo completo.

`EstadoCarga.jsx`: se quitó el prefijo genérico "No se pudo cargar:" antes
del mensaje de error, porque los mensajes ahora ya son oraciones completas
en español (ver corrección 4 más abajo) y el prefijo quedaba redundante.

`MiEmpresa.jsx` (sin empresa seleccionada) ya decía qué falta, qué hacer, y
por qué (buscar la empresa en la barra lateral para ver qué cambió y por
qué) — no se modificó, ya cumplía el criterio.

No se revisaron exhaustivamente los estados vacíos internos de
`LegacyApp.jsx` (fuera del texto puntual autorizado).

## 7. Pantalla angosta — NO VERIFICADO visualmente, revisado por código

Sin navegador no se puede confirmar en 390px real. Se revisaron las media
queries de los cuatro archivos señalados:

- `frontend/src/app/layout.css`: una sola media query (`max-width: 860px`)
  que apila la barra lateral sobre el contenido. No tiene anchos fijos que
  rompan en 390px (`.barra-lateral` pasa a `width: auto`).
- `frontend/src/secciones/ciclo.css`: una media query (`max-width: 720px`)
  que colapsa `.fila-barra` de grid de 3 columnas a 1 columna.
- `frontend/src/componentes/componentes.css` y
  `frontend/src/secciones/apis.css`: **no tenían ninguna media query**.
  `.rejilla-2`/`.rejilla-3` usan `grid-template-columns: repeat(auto-fit,
  minmax(...))`, que colapsa a una columna sola por diseño de CSS Grid, sin
  necesitar media query.

Se detectó un riesgo concreto: las tablas `.tabla` (definidas en
`estilos/base.css`) no tenían contenedor con `overflow-x`. La tabla de
Cascada en `CicloRevisiones.jsx` tiene 5 columnas, dos de ellas con montos
en soles (`S/ 1,234,567.89`, una sola palabra sin espacios, no puede
partirse en dos líneas), lo que en 390px puede forzar que la tabla sea más
ancha que su contenedor y produzca scroll horizontal de página. Se agregó
la clase `.tabla-scroll` (`overflow-x: auto`) en `componentes.css`,
siguiendo el patrón sugerido en el brief, y se envolvieron con ella las dos
tablas de `CicloRevisiones.jsx` (Calendario y Cascada). No se verificó
visualmente que esto resuelva el desborde en 390px reales; es una
prevención razonada desde el código, no una medición.

No se tocaron las tablas de `Calidad.jsx` (2-3 columnas, texto con espacios
que puede partirse en líneas) ni las de `LegacyApp.jsx` / `App.css` (fuera
de alcance de esta tarea).

## Correcciones acumuladas de tareas anteriores aplicadas en esta tarea

1. **`MarcaSintetico` ahora se usa** en la tabla de Calendario de
   `CicloRevisiones.jsx`. Cada fila se marca según el `origen` del período
   consultado en `useSeleccion()` (no se hardcodeó el umbral 132).
2. **`title` ya no es el único vehículo de explicación** en
   `Variacion.jsx` y `MarcaSintetico.jsx`: ambos ahora usan
   `aria-describedby` apuntando a un `<span className="solo-lectores">`
   con el mismo texto, conservando el `title` para quien usa ratón.
3. **`localStorage.getItem`/`setItem` envueltos en `try/catch`** en
   `frontend/src/app/Aplicacion.jsx`, incluido el inicializador del
   `useState` del tema.
4. **Mensaje de red en español** en `frontend/src/app/contexto.jsx`: cuando
   no hay `e.response` (falla de red, no HTTP), se muestra "no se pudo
   contactar con el servicio de liquidaciones" en vez del `e.message` de
   axios en inglés.
5. **`aria-hidden="true"`** agregado a los `<span>` decorativos de barra en
   `Impacto` (`CicloRevisiones.jsx`). No era un defecto funcional (están
   vacíos), pero ahora queda explícito para cualquier tecnología asistiva.
6. **Banner de error del modo agente por prop**: en `LegacyApp.jsx`
   (~línea 2107), cuando el modo llega por prop (`modoInicial !== null`, es
   decir desde `Panorama`/`MiEmpresa`) ya no hay botón de "volver a
   seleccionar empresa" oculto sin reemplazo; ahora el banner agrega el
   texto "Puedes cambiar de empresa o de periodo desde la barra lateral."
   Es el único cambio hecho en ese archivo en esta tarea.

## Verificaciones ejecutadas

```
cd frontend
npm test    # 19 passed (19)
npm run lint  # sin errores (solo warnings preexistentes, en su mayoría en LegacyApp.jsx)
npm run build # build exitoso, 667 módulos transformados
```

El conteo de módulos subió de 666 a 667 porque `MarcaSintetico.jsx` — que
antes no lo importaba nadie — ahora se usa en `CicloRevisiones.jsx` y entra
al grafo de módulos.

## Resumen de lo no cubierto

- Recorrido completo por teclado (Step 2): no ejecutado, requiere navegador.
- Simulador de daltonismo (Step 4): no ejecutado, requiere navegador.
- Medición real en 390px (Step 7): no ejecutado, requiere navegador; se hizo
  únicamente revisión de código y una corrección preventiva razonada.
- Auditoría exhaustiva de `LegacyApp.jsx` (nombres accesibles, jerarquía de
  encabezados, estados vacíos): revisión parcial únicamente, sin
  modificaciones más allá del texto puntual autorizado. Se documentan dos
  hallazgos (el `<h1>` duplicado y el `<select>` sin nombre accesible) para
  que no se asuma que ese archivo fue auditado por completo.
- "Procesos" y "Red y precios": fuera de alcance de este plan (endpoints
  que no existen todavía), como ya indicaba el brief de esta tarea.

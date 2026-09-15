# Contexto — Reportes Intermedios: Entregas y Retiros

## Descripción del proceso

Dos submódulos hermanos que miden el flujo físico de energía en el sistema (no montos económicos, sino cantidades de energía):

- **Entregas**: energía que un punto de entrega (típicamente una central generadora) inyecta al sistema.
- **Retiros**: energía que un cliente final retira del sistema en una barra específica, atribuida a la empresa generadora que se la vendió. **Aquí es donde aparecen empresas consumidoras reales** (industriales, mineras, retail) — no solo agentes del mercado eléctrico — por eso los clientes de Retiros usan su propio namespace de anonimización (`CLIENTE_NNN`).

## Datasets

### `puntos_entrega.json`
- **Descripción**: catálogo de los 373 puntos de entrega activos y la empresa (anonimizada) a la que pertenece cada uno.
- **Fuente conceptual**: `TRN_CODIGO_ENTREGA` (Oracle).
- **Campos**: `codentcodi`, `codentcodigo` (código legible, ej. `"EG00001ACH"`), `barrcodi`, `barrnombre`, `emprcodi` (anonimizado), `emprruc` (anonimizado).

### `entregas_historico_diario.json`
- **Descripción**: energía promedio entregada por día, por punto de entrega, los 8 meses.
- **Fuente conceptual**: `TRN_TRANS_ENTREGA`/`TRN_TRANS_ENTREGA_DETALLE` (Oracle), última versión cerrada por mes.
- **Campos**: `codentcodi` (join con `puntos_entrega.json` para saber la empresa), `dia`, `recacodi`, `recanombre`, `recaestado`, `valor`, `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

### `retiros_historico_diario.json`
- **Descripción**: energía promedio retirada por día, por combinación (cliente final, barra), agrupado por la empresa generadora responsable de esa venta, los 8 meses.
- **Fuente conceptual**: `TRN_TRANS_RETIRO`/`TRN_TRANS_RETIRO_DETALLE` (Oracle). El sistema real exige una cascada de 3 pasos (elegir generadora → ver combinaciones cliente-barra → pedir el histórico) porque la tabla fuente tiene decenas de millones de filas — se replicó esa misma cascada para construir este dataset.
- **Muestreo — léelo antes de sacar conclusiones de mercado completo**: a diferencia de todos los demás datasets de este paquete, este **no cubre las ~56 empresas generadoras activas**, sino una **muestra fija de 12** (las de menor código interno, elegidas de forma determinista, las mismas en los 8 meses cuando están presentes). Motivo: cada generadora exige su propia cascada de llamadas (combinaciones + histórico), y replicar esto para las ~56 generadoras × 8 meses demostró tomar **varias horas** en una corrida real — muy por encima de lo razonable para un dataset de hackatón. Si necesitas el universo completo de generadoras, puedes reproducirlo tú mismo ejecutando `scripts/generar_datasets_hackacoes.py` con más tiempo disponible (el código no tiene el muestreo activado si se ajusta `MUESTRA_GENERADORAS_N` en `scripts/generadores.py`).
- **Campos**: `barrcodi`, `cliente_id` (anonimizado, namespace `CLIENTE_`), `generador_id` (anonimizado, namespace `EMPRESA_`), `etiqueta` (reconstruida como `"{cliente_id} — {nombre real de la barra}"`), `dia`, `recacodi`, `recanombre`, `recaestado`, `valor`, `version`, `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

## Diccionario de datos

| Campo | Descripción | Tipo | Ejemplo | Obligatorio | Observaciones |
|---|---|---|---|---|---|
| `codentcodi` | Código interno del punto de entrega | integer | `375` | Sí | Únelo con `puntos_entrega.json` |
| `codentcodigo` | Código legible del punto | string | `"EG00001ACH"` | Sí | No es sensible (código técnico, no nombre de persona/empresa) |
| `cliente_id` | Identificador anonimizado del cliente final que retira energía | string | `"CLIENTE_007"` | Sí | Namespace separado de `empresa_id` — ver `_catalogos_comunes/clientes_retiros.json` |
| `generador_id` | Identificador anonimizado de la empresa generadora | string | `"EMPRESA_014"` | Sí | Mismo namespace que el resto de datasets |
| `valor` | Energía promedio del día | string (decimal) | `"0.0050363172"` | Sí | Unidad según fuente original (MWh) |

## Relaciones

```text
entregas_historico_diario.json.codentcodi
        ↓
puntos_entrega.json.codentcodi → emprcodi (empresa dueña del punto)

retiros_historico_diario.json.barrcodi
        ↓
_catalogos_comunes/barras.json.barrcodi

retiros_historico_diario.json.cliente_id
        ↓
_catalogos_comunes/clientes_retiros.json.cliente_id

retiros_historico_diario.json.generador_id
        ↓
_catalogos_comunes/empresas.json.empresa_id
```

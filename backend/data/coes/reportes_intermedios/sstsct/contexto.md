# Contexto — Reportes Intermedios: SST-SCT

## Descripción del proceso

SST-SCT = Sistemas Secundarios de Transmisión. Compensa a las empresas dueñas de líneas de transmisión secundaria por su uso, según dos mecanismos que se calculan de forma completamente distinta:

1. **Criterio de Uso**: cada empresa generadora paga, según qué tanto usa (por distancia eléctrica) cada obra de transmisión secundaria, a la empresa titular de esa obra.
2. **Ingreso Tarifario**: una fórmula regulatoria (`K_titular × % de participación en Potencia`) que combina un valor fijo mensual (establecido por resolución de OSINERGMIN) con la participación de cada generador en el mercado de Potencia.

## Datasets

### `desglose_por_valorizacion.json`
- **Descripción**: monto por empresa, Valorización ("Criterio de Uso" o "Ingreso Tarifario") y Concepto (el nombre del sistema de transmisión, o de la empresa titular según el mecanismo).
- **Fuente conceptual**: `ST_PAGOASIGNADO`/`ST_COMPENSACION` (Oracle) + tabla propia `sstsct_titularidad` (quién es dueño de cada obra — no existe en Oracle) + tabla propia `sstsct_ingreso_tarifario` (el valor K_titular regulatorio) + `VTP_INGRESO_POTENCIA` (Oracle).
- **Periodo**: 2026-01-01 a 2026-08-31.
- **Campos**: `emprcodi` (anonimizado), `emprruc` (anonimizado), `valorizacion`, `concepto`, `monto`, `pericodi`, `perinombre`, `perianiomes`, `periodo_preliminar`.

## Diccionario de datos

| Campo | Descripción | Tipo | Ejemplo | Obligatorio | Observaciones |
|---|---|---|---|---|---|
| `emprcodi` | Identificador anonimizado de la empresa generadora (deudora) | string | `"EMPRESA_014"` | Sí | |
| `valorizacion` | Mecanismo | string | `"Asignación responsabilidad de pago SST-SCT - Criterio de Uso"` | Sí | Ver "Códigos y parámetros" |
| `concepto` | En "Criterio de Uso": nombre del sistema de transmisión. En "Ingreso Tarifario": identifica a la empresa **titular** que recibe el pago | string | `"Mantaro-Lima"` (sistema) o un identificador anonimizado `EMPRESA_NNN` (titular) | Sí | Cuando el concepto era el nombre real de la empresa titular, se anonimizó igual que `emprcodi` |
| `monto` | Monto de esa fila | string (decimal) | `"-0.5494519194"` | Sí | En Soles (S/) |

## Relaciones

```text
desglose_por_valorizacion.json.emprcodi (empresa deudora/generadora)
        ↓
_catalogos_comunes/empresas.json.empresa_id

desglose_por_valorizacion.json.concepto (cuando es "Ingreso Tarifario", identifica a la empresa titular/acreedora)
        ↓ también resuelve a
_catalogos_comunes/empresas.json.empresa_id  (mismo namespace que emprcodi)
```

## Códigos y parámetros

```text
valorizacion

"Asignación responsabilidad de pago SST-SCT - Criterio de Uso"        → compensación por uso real (distancia eléctrica)
"Asignación responsabilidad de pago SST-SCT - Ingreso Tarifario"      → fórmula regulatoria K_titular × % Potencia
```

## Caso especial conocido — no es un error

Una misma empresa (anonimizada) puede aparecer pagándose **a sí misma** en una fila (monto neto cercano a cero). Ocurre porque algunas empresas grandes son simultáneamente generadoras y dueñas de su propia línea de transmisión secundaria — el mecanismo de cálculo las trata como dos roles económicos distintos, aunque sea la misma entidad. Es un comportamiento de negocio real y verificado, sin efecto de pago neto.

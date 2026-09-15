# Capa de Datos Curada y Backend Consolidado — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dejar un backend FastAPI limpio, modular y desplegable que sirve los 20 meses del dataset extendido y el historial de revisiones desde una capa parquet curada.

**Architecture:** Un script ETL determinista convierte el welcome kit (JSON, 406 MB) en parquet curado (~40-60 MB) con dimensiones, hechos y agregados. El backend lee solo parquet al arrancar. `main.py` se divide en routers por dominio y se agrega `revision_service.py`, el módulo de trazabilidad de revisiones. Todo el código muerto identificado en el spec se elimina bajo la protección de tests de caracterización escritos antes de tocar nada.

**Tech Stack:** Python 3.13, FastAPI, pandas, pyarrow, pytest, httpx (TestClient).

**Spec:** `docs/superpowers/specs/2026-09-15-coes-consolidacion-design.md`

## Global Constraints

- **Clave de empresa:** `EMPRESA_00X` es la clave técnica en todo el backend. El RUC real nunca entra al código ni a la API. El alias visible vive solo en `dim_empresa.parquet`, columna `alias`. (Spec D4)
- **Semilla determinista:** `SEED = 20260915` en todo el ETL. Misma entrada, misma salida.
- **Campo `origen`:** se propaga sin modificar desde el kit hasta la respuesta de la API. Valores: `"real"` | `"sintetico"`. (Spec §5)
- **Montos:** el kit entrega `monto` y `monto_total` como **strings**. El ETL los convierte a `float64`. Nunca sumar montos de distintas revisiones del mismo período: es doble contabilidad. (Spec §6.3)
- **Encoding:** todos los JSON del kit son UTF-8. Abrir siempre con `encoding="utf-8"`.
- **Los datos crudos no se versionan.** `backend/data/raw/` va en `.gitignore`. `backend/data/curated/` sí se versiona.
- **Comandos:** el intérprete es el del venv, `backend/venv/Scripts/python.exe` en Windows. Los comandos de este plan asumen que el venv está activado y el directorio actual es `backend/`.

---

### Task 1: Red de seguridad — tests de caracterización

Antes de borrar nada, se fija el comportamiento actual de los endpoints que el frontend sí consume. Estos tests deben seguir pasando después de cada tarea de limpieza.

**Files:**
- Modify: `backend/requirements.txt` (reescribir en UTF-8)
- Create: `backend/pytest.ini`
- Create: `backend/tests/__init__.py`
- Create: `backend/tests/conftest.py`
- Test: `backend/tests/test_caracterizacion.py`

**Interfaces:**
- Consumes: nada.
- Produces: fixture `cliente` (`fastapi.testclient.TestClient`) disponible para todas las tareas siguientes.

- [ ] **Step 1: Reescribir `requirements.txt` en UTF-8**

El archivo actual está en UTF-16 con BOM (`b'\xff\xfe'`), lo que rompe `pip install -r` en el builder de Linux de Render. Se reescribe en UTF-8 y se ajustan las dependencias: sale OpenAI, entran las de parquet y pruebas.

> **Las dependencias de `scikit-learn` se quedan en esta tarea.** `main.py`
> todavía importa `app.ml_model`, que las necesita, y sin ellas `app.main` ni
> siquiera se puede importar — los tests de caracterización no correrían. Salen
> en la Task 2, junto con el código que las usa. El orden importa: la red de
> seguridad fija el comportamiento **antes** de borrar, no después.

Contenido completo del nuevo `backend/requirements.txt`:

```
annotated-types==0.8.0
anyio==4.15.1
click==8.5.0
fastapi==0.141.1
h11==0.16.0
httpx==0.27.2
idna==3.19
numpy==2.5.3
pandas==3.0.5
pyarrow==18.1.0
pydantic==2.13.5
pydantic_core==2.46.5
pytest==8.3.4
python-dateutil==2.9.0.post0
six==1.17.0
sniffio==1.3.1
starlette==1.6.0
truststore==0.10.4
typing-inspection==0.4.4
typing_extensions==4.16.0
tzdata==2026.3
uvicorn==0.52.4
```

Escribirlo con un heredoc desde bash, que ya emite UTF-8 sin BOM:

```bash
cat > requirements.txt <<'EOF'
annotated-types==0.8.0
anyio==4.15.1
click==8.5.0
fastapi==0.141.1
h11==0.16.0
httpx==0.27.2
idna==3.19
# Temporal: las necesita app/ml_model.py, que la Task 2 elimina.
# Al borrar ml_model.py, quitar estas cuatro lineas.
joblib==1.6.0
scikit-learn==1.9.0
scipy==1.18.1
threadpoolctl==3.6.0
numpy==2.5.3
pandas==3.0.5
pyarrow==18.1.0
pydantic==2.13.5
pydantic_core==2.46.5
pytest==8.3.4
python-dateutil==2.9.0.post0
six==1.17.0
sniffio==1.3.1
starlette==1.6.0
truststore==0.10.4
typing-inspection==0.4.4
typing_extensions==4.16.0
tzdata==2026.3
uvicorn==0.52.4
EOF
```

- [ ] **Step 2: Verificar el encoding**

Run: `python -c "print(open('requirements.txt','rb').read()[:4])"`
Expected: `b'anno'` — sin BOM `\xff\xfe`.

- [ ] **Step 3: Instalar las dependencias nuevas**

Run: `pip install -r requirements.txt`
Expected: instala `pyarrow`, `pytest` y `httpx` sin errores.

- [ ] **Step 4: Crear `pytest.ini`**

```ini
[pytest]
testpaths = tests
pythonpath = .
python_files = test_*.py
addopts = -v
```

- [ ] **Step 5: Crear `tests/__init__.py` vacío y `tests/conftest.py`**

`backend/tests/__init__.py`: archivo vacío.

`backend/tests/conftest.py`:

```python
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture(scope="session")
def cliente():
    """Cliente HTTP contra la app, compartido por toda la sesión de pruebas.

    Es scope=session porque levantar la app carga los datasets, que es caro.
    """
    with TestClient(app) as c:
        yield c
```

- [ ] **Step 6: Escribir los tests de caracterización**

Estos tests describen lo que el frontend usa hoy. No prueban lógica de negocio: prueban que el contrato no se rompa durante la limpieza.

`backend/tests/test_caracterizacion.py`:

```python
"""Fija el contrato de los endpoints que el frontend consume hoy.

El frontend (frontend/src/App.jsx) solo llama a cuatro familias:
/periodos, /empresas, /radar/{pericodi} y /agente/*. Estos tests deben
seguir pasando después de cada tarea de limpieza del plan.
"""

PERIODO_DEMO = 138
EMPRESA_DEMO = "EMPRESA_001"


def test_health_responde(cliente):
    respuesta = cliente.get("/health")
    assert respuesta.status_code == 200


def test_periodos_devuelve_lista_con_pericodi(cliente):
    respuesta = cliente.get("/periodos")
    assert respuesta.status_code == 200

    periodos = respuesta.json()["periodos"]
    assert len(periodos) > 0
    assert "pericodi" in periodos[0]
    assert "perinombre" in periodos[0]


def test_empresas_devuelve_lista_con_empresa_id(cliente):
    respuesta = cliente.get("/empresas")
    assert respuesta.status_code == 200

    empresas = respuesta.json()["empresas"]
    assert len(empresas) > 0
    assert "empresa_id" in empresas[0]


def test_radar_de_un_periodo_valido(cliente):
    respuesta = cliente.get(f"/radar/{PERIODO_DEMO}")
    assert respuesta.status_code == 200


def test_radar_de_un_periodo_inexistente_es_404(cliente):
    respuesta = cliente.get("/radar/99999")
    assert respuesta.status_code == 404


def test_agente_resumen(cliente):
    respuesta = cliente.get(
        f"/agente/resumen/{EMPRESA_DEMO}/{PERIODO_DEMO}"
    )
    assert respuesta.status_code == 200


def test_agente_explicacion(cliente):
    respuesta = cliente.get(
        f"/agente/explicacion/{EMPRESA_DEMO}/{PERIODO_DEMO}"
    )
    assert respuesta.status_code == 200


def test_agente_contexto(cliente):
    respuesta = cliente.get(
        f"/agente/contexto/{EMPRESA_DEMO}/{PERIODO_DEMO}"
    )
    assert respuesta.status_code == 200
```

- [ ] **Step 7: Correr los tests contra el código actual**

Run: `pytest tests/test_caracterizacion.py`
Expected: **PASS**, los 8. Si alguno falla, el endpoint ya estaba roto antes de empezar — anotarlo y decidir si se arregla o se elimina, pero no seguir hasta resolverlo.

- [ ] **Step 8: Commit**

```bash
git add backend/requirements.txt backend/pytest.ini backend/tests/
git commit -m "test: red de seguridad antes de la limpieza

Fija el contrato de los endpoints que el frontend consume y corrige
requirements.txt, que estaba en UTF-16 con BOM y rompia pip en Linux."
```

---

### Task 2: Eliminar el código muerto del backend

**Files:**
- Delete: `backend/app/llm.py`, `backend/app/services/analyst_service.py`, `backend/app/services/traceability_service.py` (los tres vacíos)
- Delete: `backend/diagnostico_a4.py`, `backend/app/ml_model.py`, `backend/app/data_generator.py`, `backend/liquidaciones.csv`
- Modify: `backend/app/main.py` (quitar endpoints muertos y el `/periodos` duplicado)
- Modify: `backend/app/analysis.py` (dejar solo lo que usa `/radar`)
- Modify: `backend/app/services/agent_service.py:3683-4269` (quitar el bloque `__main__`)
- Modify: `backend/app/services/integrity_service.py:1211-1356` (quitar el bloque `__main__`)
- Modify: `backend/requirements.txt` (quitar las dependencias de ML que la Task 1 dejó como temporales)

**Interfaces:**
- Consumes: fixture `cliente` de Task 1.
- Produces: `app.analysis` expone únicamente `calcular_score_relevancia(...)` y su auxiliar `calcular_score_historico(z_score)`.

- [ ] **Step 1: Borrar los archivos sin uso**

Los tres primeros tienen 0 líneas. `ml_model.py`, `data_generator.py`, `liquidaciones.csv` y `diagnostico_a4.py` pertenecen al universo del CSV sintético viejo, que ningún endpoint consumido por el frontend toca.

```bash
git rm backend/app/llm.py \
       backend/app/services/analyst_service.py \
       backend/app/services/traceability_service.py \
       backend/diagnostico_a4.py \
       backend/app/ml_model.py \
       backend/app/data_generator.py \
       backend/liquidaciones.csv
```

- [ ] **Step 2: Quitar de `main.py` los imports y endpoints muertos**

Eliminar estas líneas de import (líneas 7-15 del archivo original):

```python
from app.analysis import (
    cargar_datos,
    obtener_liquidacion,
    obtener_detalle_conceptos,
    comparar_mismo_periodo_anterior,
    analizar_liquidacion
)

from app.ml_model import obtener_anomalia
```

Dejar únicamente:

```python
from app.analysis import calcular_score_relevancia
```

Eliminar los bloques completos de estos endpoints, que ningún cliente llama:

| Endpoint | Línea original |
|---|---|
| `/agentes` | 93 |
| `/conceptos` | 119 |
| `/liquidaciones/{agente_id}/{fecha}` | 145 |
| `/liquidaciones/{agente_id}/{fecha}/detalle` | 172 |
| `/analisis/{agente_id}/{fecha}` | 203 |
| `/comparacion-interanual/{agente_id}/{fecha}` | 696 |

Eliminar además la **segunda** definición de `/periodos` (línea 271) y la **segunda** de `/radar/{fecha}`, conservando una sola de cada una.

- [ ] **Step 3: Podar `analysis.py`**

Conservar el encabezado de imports, `calcular_score_relevancia` (línea 540) y `calcular_score_historico` (línea 703). Eliminar todo lo demás: `cargar_datos`, `obtener_liquidacion`, `obtener_detalle_conceptos`, `comparar_periodos`, `comparar_mismo_periodo_anterior`, `analizar_comportamiento_historico`, `analizar_factores`, `analizar_liquidacion` y el bloque `__main__` (línea 996 en adelante).

Quitar también las constantes `BASE_DIR` y `DATA_FILE` si quedan sin uso tras la poda, y el `import pandas as pd` si ya no se usa.

- [ ] **Step 4: Quitar los bloques `__main__`**

En `backend/app/services/agent_service.py`, borrar desde la línea 3683 (`if __name__ == "__main__":`) hasta el final del archivo. Son 587 líneas de script de prueba con `pericodi` fijos en 138 y 139.

En `backend/app/services/integrity_service.py`, borrar desde la línea 1211 hasta el final. Son 146 líneas.

- [ ] **Step 5: Quitar de `requirements.txt` las dependencias de ML**

Ya no queda código que las use: `ml_model.py` se borró en el Step 1. Eliminar el bloque que la Task 1 dejó marcado como temporal:

```
# Temporal: las necesita app/ml_model.py, que la Task 2 elimina.
# Al borrar ml_model.py, quitar estas cuatro lineas.
joblib==1.6.0
scikit-learn==1.9.0
scipy==1.18.1
threadpoolctl==3.6.0
```

Reescribir el archivo con el mismo heredoc de bash del Step 1 de la Task 1, para no reintroducir el BOM.

- [ ] **Step 6: Correr los tests de caracterización**

Run: `pytest tests/test_caracterizacion.py`
Expected: **PASS**, los 8. Si falla el import de `app.main`, quedó una referencia a algo eliminado.

Verificar además que la app ya no necesita scikit-learn:

Run: `python -c "import app.main; print('importa sin sklearn')"`
Expected: imprime el mensaje sin `ModuleNotFoundError`.

- [ ] **Step 7: Verificar el tamaño de la poda**

Run: `python -c "import pathlib; print(sum(len(p.read_text(encoding='utf-8').splitlines()) for p in pathlib.Path('app').rglob('*.py')))"`
Expected: alrededor de 5.400 líneas, frente a las 8.686 originales.

- [ ] **Step 8: Commit**

```bash
git add -A backend/
git commit -m "refactor: eliminar el universo del CSV sintetico del backend

Borra ml_model.py, data_generator.py, liquidaciones.csv, tres archivos
vacios y los bloques __main__ de prueba. Quita 7 endpoints que ningun
cliente llamaba y la definicion duplicada de /periodos y /radar.
De analysis.py sobrevive solo calcular_score_relevancia, que usa /radar."
```

---

### Task 3: Eliminar el código muerto del frontend y el prototipo roto

**Files:**
- Delete: `frontend/src/App_bk.jsx`, `App_bk2.jsx`, `App_bk3.jsx`, `App_bk.css`, `index_bk.css`, `text.jsx`
- Delete: `complemento/COES · Monitoreo de Liquidaciones _ Prototipo.html`

**Interfaces:**
- Consumes: nada.
- Produces: nada. `frontend/src/App.jsx` queda intacto para el plan 2.

- [ ] **Step 1: Confirmar que nada importa los archivos a borrar**

Run:
```bash
grep -rn "App_bk\|index_bk\|from \"./text\|from './text" frontend/src/ --include=*.jsx --include=*.css
```
Expected: sin resultados. Si aparece algo, resolver esa referencia antes de borrar.

- [ ] **Step 2: Borrar los backups del frontend**

```bash
git rm "frontend/src/App_bk.jsx" \
       "frontend/src/App_bk2.jsx" \
       "frontend/src/App_bk3.jsx" \
       "frontend/src/App_bk.css" \
       "frontend/src/index_bk.css" \
       "frontend/src/text.jsx"
```

- [ ] **Step 3: Borrar el prototipo roto**

Referencia una carpeta `_files/` con su CSS, su JS y sus datos, que no existe en el repo. No abre.

```bash
git rm "complemento/COES · Monitoreo de Liquidaciones _ Prototipo.html"
```

- [ ] **Step 4: Verificar que el frontend sigue compilando**

Run: `cd frontend && npm run build`
Expected: build exitoso.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "chore: eliminar backups del frontend y el prototipo roto

Los cuatro App_bk*, los dos *_bk.css y text.jsx no los importaba nadie
(~4.300 lineas). El Prototipo.html referencia una carpeta _files/ que no
existe en el repo, asi que no abre."
```

---

### Task 4: Materializar el kit crudo y eliminar la copia duplicada

**Files:**
- Create: `backend/data/raw/` (contenido del welcome kit, fuera de git)
- Modify: `.gitignore`
- Delete: `backend/data/coes/` (140 MB, copia byte-idéntica del kit)
- Delete: `complemento/00_WELCOME KIT HACKACOES/Agendas/`, `Presentaciones Mentores COES/`, `portal/datos/`

**Interfaces:**
- Consumes: nada.
- Produces: la ruta `backend/data/raw/` con la estructura `_catalogos_comunes/`, `liquidaciones/`, `reportes_intermedios/`, `revisiones/`, que el ETL de las tareas 5-8 lee.

- [ ] **Step 1: Confirmar que `backend/data/coes/` es una copia exacta del kit**

Run:
```bash
python - <<'PY'
import hashlib, pathlib
kit = pathlib.Path("complemento/00_WELCOME KIT HACKACOES")
copia = pathlib.Path("backend/data/coes")
def md5(p): return hashlib.md5(p.read_bytes()).hexdigest()
distintos = [
    f for f in copia.rglob("*.json")
    if not (kit / f.relative_to(copia)).exists()
    or md5(f) != md5(kit / f.relative_to(copia))
]
print("archivos que difieren:", distintos or "ninguno")
PY
```
Expected: `ninguno`. Los 19 JSON son idénticos.

- [ ] **Step 2: Mover el kit a `backend/data/raw/`**

Se mueven solo los datos. Los PDF, las agendas y `portal/datos/` (regenerable) no entran.

```bash
mkdir -p backend/data/raw
cp -r "complemento/00_WELCOME KIT HACKACOES/_catalogos_comunes" backend/data/raw/
cp -r "complemento/00_WELCOME KIT HACKACOES/liquidaciones" backend/data/raw/
cp -r "complemento/00_WELCOME KIT HACKACOES/reportes_intermedios" backend/data/raw/
cp -r "complemento/00_WELCOME KIT HACKACOES/revisiones" backend/data/raw/
cp "complemento/00_WELCOME KIT HACKACOES/inventario_datasets_extendido.json" backend/data/raw/
```

- [ ] **Step 3: Verificar que llegó lo esperado**

Run: `ls backend/data/raw/ && ls backend/data/raw/revisiones/`
Expected: cuatro carpetas más `inventario_datasets_extendido.json`; en `revisiones/`, los tres JSON más su README.

- [ ] **Step 4: Añadir al `.gitignore` los datos crudos y el kit**

> **Crítico.** El welcome kit en `complemento/00_WELCOME KIT HACKACOES/` está
> **sin trackear** y pesa **536 MB**. El Step 6 hace `git add -A`. Si el kit no
> está ignorado antes de ese punto, se commitean medio giga al repo. Este paso
> va **antes** que cualquier `git add`.

Agregar al final de `.gitignore`:

```
# --- Datos crudos: no se versionan ---
# El welcome kit (536 MB) es la fuente; data/raw/ es su copia de trabajo y
# data/curated/ (si versionado) es lo que el backend consume.
backend/data/raw/
complemento/00_WELCOME KIT HACKACOES/
```

Verificar que surtió efecto antes de seguir:

Run: `git status --porcelain | grep -c "WELCOME KIT"`
Expected: `0`.

- [ ] **Step 5: Eliminar la copia duplicada y el peso muerto del kit**

`backend/data/coes` **sí** está trackeado, así que sale del índice con `git rm --cached`. Las rutas del kit **no** lo están, así que se borran con `rm -rf` a secas — un `git rm` sobre ellas falla con *"did not match any files"*.

```bash
# Trackeado: sale del indice y del disco.
git rm -r --cached backend/data/coes
rm -rf backend/data/coes

# Sin trackear: solo del disco.
rm -rf "complemento/00_WELCOME KIT HACKACOES/Agendas" \
       "complemento/00_WELCOME KIT HACKACOES/Presentaciones Mentores COES" \
       "complemento/00_WELCOME KIT HACKACOES/portal/datos"
```

> Los tests de caracterización van a fallar a partir de aquí, porque `loader.py` apunta a `backend/data/coes/`. Se reparan en la Task 9. Es esperado y está acotado a las tareas 5-8.

- [ ] **Step 6: Commit, con verificación de que no se cuela nada pesado**

Antes de commitear, comprobar qué se está por agregar:

```bash
git add -A
git diff --cached --stat | tail -1
git diff --cached --name-only | grep -E "WELCOME KIT|data/raw" | head
```

Expected: el resumen muestra solo borrados y el cambio de `.gitignore`; el segundo comando no devuelve nada. Si aparece cualquier ruta del kit o de `data/raw`, **no commitear**: revisar el Step 4.

```bash
git commit -m "chore: mover el kit a data/raw y eliminar la copia duplicada

backend/data/coes eran 140 MB byte-identicos al welcome kit, ademas sin
las versiones extendidas ni revisiones/. Los datos crudos pasan a
backend/data/raw, fuera de git; el ETL genera curated/ desde ahi."
```

---

### Task 5: ETL — dimensiones

**Files:**
- Create: `backend/scripts/__init__.py`
- Create: `backend/scripts/preparar_datos.py`
- Test: `backend/tests/test_etl_dimensiones.py`

**Interfaces:**
- Consumes: `backend/data/raw/` de Task 4.
- Produces:
  - `RAW = Path("data/raw")`, `CURATED = Path("data/curated")`, `SEED = 20260915`
  - `leer_json(ruta_relativa: str) -> list[dict]`
  - `construir_dim_empresa() -> pd.DataFrame` con columnas `empresa_id`, `alias`
  - `construir_dim_periodo() -> pd.DataFrame`
  - `construir_dim_barra() -> pd.DataFrame`
  - `main()` que escribe todos los parquet

- [ ] **Step 1: Escribir el test que falla**

`backend/tests/test_etl_dimensiones.py`:

```python
import pandas as pd
import pytest

from scripts.preparar_datos import (
    construir_dim_empresa,
    construir_dim_periodo,
    construir_dim_barra,
)


@pytest.fixture(scope="module")
def dim_empresa():
    return construir_dim_empresa()


def test_dim_empresa_tiene_una_fila_por_empresa(dim_empresa):
    assert len(dim_empresa) == 131
    assert list(dim_empresa.columns) == ["empresa_id", "alias"]


def test_los_alias_son_unicos(dim_empresa):
    assert dim_empresa["alias"].nunique() == len(dim_empresa)


def test_el_alias_es_estable_entre_ejecuciones():
    primera = construir_dim_empresa()
    segunda = construir_dim_empresa()
    pd.testing.assert_frame_equal(primera, segunda)


def test_el_alias_no_contiene_ruc_ni_el_id_tecnico(dim_empresa):
    texto = " ".join(dim_empresa["alias"])
    assert "RUC" not in texto
    assert "EMPRESA_" not in texto


def test_dim_periodo_cubre_los_veinte_meses():
    periodos = construir_dim_periodo()
    assert len(periodos) == 20
    assert periodos["pericodi"].min() == 120
    assert periodos["pericodi"].max() == 139
    assert set(periodos["origen"]) == {"real", "sintetico"}


def test_dim_barra_conserva_los_nombres_reales():
    barras = construir_dim_barra()
    assert len(barras) == 828
    assert {"barrcodi", "barrnombre", "barrtension"} <= set(barras.columns)
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pytest tests/test_etl_dimensiones.py`
Expected: FAIL con `ModuleNotFoundError: No module named 'scripts.preparar_datos'`.

- [ ] **Step 3: Escribir la implementación mínima**

`backend/scripts/__init__.py`: archivo vacío.

`backend/scripts/preparar_datos.py`:

```python
"""Convierte el welcome kit COES (JSON) en una capa parquet curada.

Determinista: misma entrada, misma salida. Ejecutar desde backend/:

    python -m scripts.preparar_datos
"""

import json
import random
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
RAW = BASE_DIR / "data" / "raw"
CURATED = BASE_DIR / "data" / "curated"

SEED = 20260915

# El alias es un nombre de fantasia, no una re-identificacion. La regla 8.2
# del kit prohibe re-identificar; la clave tecnica sigue siendo EMPRESA_00X
# y el RUC real nunca entra al backend.
PREFIJOS_ALIAS = [
    "Generadora",
    "Distribuidora",
    "Transmisora",
    "Comercializadora",
    "Energia",
    "Hidroelectrica",
    "Termoelectrica",
    "Eolica",
]

SUFIJOS_ALIAS = [
    "Andina", "del Norte", "del Sur", "Pacifico", "Amazonas",
    "Central", "Altiplano", "Costa Verde", "Maranon", "Urubamba",
    "Cordillera", "del Oriente", "Pampas", "Titicaca", "Vilcanota",
    "Chira", "Santa", "Mantaro", "Rimac",
]


def leer_json(ruta_relativa: str) -> list[dict]:
    """Lee un JSON del kit crudo. Todos son arreglos de objetos planos."""
    ruta = RAW / ruta_relativa

    if not ruta.exists():
        raise FileNotFoundError(f"No se encontro {ruta}")

    with open(ruta, "r", encoding="utf-8") as archivo:
        return json.load(archivo)


def _generar_alias(cantidad: int) -> list[str]:
    """Genera alias unicos y estables, barajados con semilla fija."""
    combinaciones = [
        f"{prefijo} {sufijo}"
        for prefijo in PREFIJOS_ALIAS
        for sufijo in SUFIJOS_ALIAS
    ]

    if cantidad > len(combinaciones):
        raise ValueError(
            f"Se necesitan {cantidad} alias y solo hay "
            f"{len(combinaciones)} combinaciones."
        )

    combinaciones.sort()
    random.Random(SEED).shuffle(combinaciones)

    return combinaciones[:cantidad]


def construir_dim_empresa() -> pd.DataFrame:
    empresas = pd.DataFrame(leer_json("_catalogos_comunes/empresas.json"))
    empresas = empresas.sort_values("empresa_id").reset_index(drop=True)

    empresas["alias"] = _generar_alias(len(empresas))

    return empresas[["empresa_id", "alias"]]


def construir_dim_periodo() -> pd.DataFrame:
    periodos = pd.DataFrame(
        leer_json("_catalogos_comunes/periodos_extendido.json")
    )

    return periodos.sort_values("pericodi").reset_index(drop=True)


def construir_dim_barra() -> pd.DataFrame:
    barras = pd.DataFrame(leer_json("_catalogos_comunes/barras.json"))

    return barras.sort_values("barrcodi").reset_index(drop=True)


def escribir(tabla: pd.DataFrame, nombre: str) -> None:
    CURATED.mkdir(parents=True, exist_ok=True)
    destino = CURATED / f"{nombre}.parquet"

    tabla.to_parquet(destino, index=False, compression="snappy")

    print(f"  {nombre:<28} {len(tabla):>9,} filas")


def main() -> None:
    print("Construyendo dimensiones...")
    escribir(construir_dim_empresa(), "dim_empresa")
    escribir(construir_dim_periodo(), "dim_periodo")
    escribir(construir_dim_barra(), "dim_barra")


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pytest tests/test_etl_dimensiones.py`
Expected: PASS, los 6.

- [ ] **Step 5: Generar los parquet de dimensiones**

Run: `python -m scripts.preparar_datos`
Expected: imprime las tres tablas con 131, 20 y 828 filas.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/ backend/tests/test_etl_dimensiones.py backend/data/curated/
git commit -m "feat: ETL de dimensiones a parquet

dim_empresa incluye el alias de fantasia estable (semilla 20260915);
la clave tecnica sigue siendo EMPRESA_00X y el RUC real no entra.
dim_periodo toma el catalogo extendido de 20 meses."
```

---

### Task 6: ETL — hechos de liquidación

**Files:**
- Modify: `backend/scripts/preparar_datos.py`
- Test: `backend/tests/test_etl_hechos.py`

**Interfaces:**
- Consumes: `leer_json`, `escribir` de Task 5.
- Produces:
  - `a_float(serie: pd.Series) -> pd.Series`
  - `construir_fact_evolucion() -> pd.DataFrame`
  - `construir_fact_bilateral() -> pd.DataFrame`
  - `construir_fact_desglose() -> pd.DataFrame` con columna `proceso` en `{"LVTP", "SST-SCT", "LSCIO"}`
  - `TABLAS_SOPORTE: dict[str, tuple[str, str | None]]` y `construir_soporte(clave: str) -> pd.DataFrame`

- [ ] **Step 1: Escribir el test que falla**

`backend/tests/test_etl_hechos.py`:

```python
import pandas as pd
import pytest

from scripts.preparar_datos import (
    construir_fact_evolucion,
    construir_fact_bilateral,
    construir_fact_desglose,
)


def test_fact_evolucion_carga_los_veinte_meses():
    evolucion = construir_fact_evolucion()

    assert len(evolucion) == 109_458
    assert evolucion["pericodi"].nunique() == 20


def test_el_monto_es_numerico_no_texto():
    evolucion = construir_fact_evolucion()

    assert pd.api.types.is_float_dtype(evolucion["monto"])


def test_fact_bilateral_tiene_deudora_y_acreedora():
    bilateral = construir_fact_bilateral()

    assert len(bilateral) == 141_816
    assert {"empresa_deudora", "empresa_acreedora"} <= set(bilateral.columns)
    assert pd.api.types.is_float_dtype(bilateral["monto"])


def test_fact_desglose_unifica_los_tres_procesos():
    desglose = construir_fact_desglose()

    assert set(desglose["proceso"]) == {"LVTP", "SST-SCT", "LSCIO"}
    assert len(desglose) == 126_304
    assert pd.api.types.is_float_dtype(desglose["monto"])


def test_todos_los_hechos_conservan_el_campo_origen():
    for construir in (
        construir_fact_evolucion,
        construir_fact_bilateral,
        construir_fact_desglose,
    ):
        tabla = construir()
        assert "origen" in tabla.columns
        assert set(tabla["origen"]) <= {"real", "sintetico"}
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pytest tests/test_etl_hechos.py`
Expected: FAIL con `ImportError: cannot import name 'construir_fact_evolucion'`.

- [ ] **Step 3: Escribir la implementación**

Agregar a `backend/scripts/preparar_datos.py`, después de `construir_dim_barra`:

```python
def a_float(serie: pd.Series) -> pd.Series:
    """El kit entrega los montos como texto. Aqui pasan a float64."""
    return pd.to_numeric(serie, errors="coerce").astype("float64")


def construir_fact_evolucion() -> pd.DataFrame:
    evolucion = pd.DataFrame(
        leer_json("liquidaciones/evolucion_mensual_extendido.json")
    )
    evolucion["monto"] = a_float(evolucion["monto"])

    return evolucion


def construir_fact_bilateral() -> pd.DataFrame:
    bilateral = pd.DataFrame(
        leer_json("liquidaciones/cruce_bilateral_extendido.json")
    )
    bilateral["monto"] = a_float(bilateral["monto"])

    return bilateral


def construir_fact_desglose() -> pd.DataFrame:
    """Unifica los tres desgloses por valorizacion en una sola tabla.

    LSCIO desglosa por 'mecanismo' en vez de 'valorizacion'; se renombra
    para que las tres fuentes compartan esquema.
    """
    fuentes = [
        (
            "LVTP",
            "reportes_intermedios/potencia/"
            "desglose_por_valorizacion_extendido.json",
            "valorizacion",
        ),
        (
            "SST-SCT",
            "reportes_intermedios/sstsct/"
            "desglose_por_valorizacion_extendido.json",
            "valorizacion",
        ),
        (
            "LSCIO",
            "reportes_intermedios/lscio/"
            "desglose_por_mecanismo_extendido.json",
            "mecanismo",
        ),
    ]

    partes = []

    for proceso, ruta, columna_valorizacion in fuentes:
        parte = pd.DataFrame(leer_json(ruta))
        parte = parte.rename(
            columns={columna_valorizacion: "valorizacion"}
        )
        parte["proceso"] = proceso
        partes.append(parte)

    desglose = pd.concat(partes, ignore_index=True)
    desglose["monto"] = a_float(desglose["monto"])

    return desglose
```

- [ ] **Step 4: Construir las tablas de soporte que los servicios ya consumen**

`AgentService` e `IntegrityService` esperan claves concretas que no se pueden renombrar sin reescribir ambos servicios. Estas tablas se copian del kit extendido tal cual, solo convirtiendo el monto.

Agregar a `preparar_datos.py`:

```python
# clave de salida -> ruta en el kit crudo, columna de monto a convertir
TABLAS_SOPORTE = {
    "energia_transferencias": (
        "reportes_intermedios/energia_activa/"
        "transferencias_por_empresa_extendido.json",
        "vtotemtotal",
    ),
    "energia_saldos": (
        "reportes_intermedios/energia_activa/saldos_extendido.json",
        "saldo_total",
    ),
    "lscio_transferencias": (
        "reportes_intermedios/lscio/"
        "transferencias_por_empresa_extendido.json",
        "monto_total",
    ),
    "lscio_desglose": (
        "reportes_intermedios/lscio/"
        "desglose_por_mecanismo_extendido.json",
        "monto",
    ),
    "lscio_saldos": (
        "reportes_intermedios/lscio/saldos_extendido.json",
        "saldo_total",
    ),
    "potencia_desglose": (
        "reportes_intermedios/potencia/"
        "desglose_por_valorizacion_extendido.json",
        "monto",
    ),
    "potencia_saldos": (
        "reportes_intermedios/potencia/saldos_extendido.json",
        "saldo_total",
    ),
    "sstsct_desglose": (
        "reportes_intermedios/sstsct/"
        "desglose_por_valorizacion_extendido.json",
        "monto",
    ),
    "costos_marginales_diario": (
        "reportes_intermedios/costos_marginales/"
        "historico_diario_extendido.json",
        "promedio",
    ),
    "entregas": (
        "reportes_intermedios/entregas_retiros/"
        "entregas_historico_diario_extendido.json",
        "valor",
    ),
    "retiros": (
        "reportes_intermedios/entregas_retiros/"
        "retiros_historico_diario_extendido.json",
        "valor",
    ),
    "puntos_entrega": (
        "reportes_intermedios/entregas_retiros/puntos_entrega.json",
        None,
    ),
}


def construir_soporte(clave: str) -> pd.DataFrame:
    """Copia una tabla del kit convirtiendo su columna de monto a float."""
    ruta, columna_monto = TABLAS_SOPORTE[clave]

    tabla = pd.DataFrame(leer_json(ruta))

    if columna_monto and columna_monto in tabla.columns:
        tabla[columna_monto] = a_float(tabla[columna_monto])

    return tabla
```

Y extender `main()`:

```python
def main() -> None:
    print("Construyendo dimensiones...")
    escribir(construir_dim_empresa(), "dim_empresa")
    escribir(construir_dim_periodo(), "dim_periodo")
    escribir(construir_dim_barra(), "dim_barra")

    print("Construyendo hechos de liquidacion...")
    escribir(construir_fact_evolucion(), "fact_evolucion")
    escribir(construir_fact_bilateral(), "fact_bilateral")
    escribir(construir_fact_desglose(), "fact_desglose")

    print("Construyendo tablas de soporte...")
    for clave in TABLAS_SOPORTE:
        escribir(construir_soporte(clave), clave)
```

- [ ] **Step 5: Añadir el test de las tablas de soporte**

Agregar al final de `backend/tests/test_etl_hechos.py`:

```python
from scripts.preparar_datos import TABLAS_SOPORTE, construir_soporte

# Las claves que AgentService e IntegrityService leen por nombre. Si alguna
# desaparece, el backend no arranca.
CLAVES_QUE_LOS_SERVICIOS_EXIGEN = {
    "energia_transferencias",
    "lscio_transferencias",
    "lscio_desglose",
    "potencia_desglose",
    "potencia_saldos",
    "sstsct_desglose",
    "costos_marginales_diario",
    "entregas",
    "retiros",
    "puntos_entrega",
}


def test_estan_todas_las_tablas_que_los_servicios_exigen():
    assert CLAVES_QUE_LOS_SERVICIOS_EXIGEN <= set(TABLAS_SOPORTE)


def test_cada_tabla_de_soporte_se_construye_y_no_viene_vacia():
    for clave in TABLAS_SOPORTE:
        tabla = construir_soporte(clave)
        assert len(tabla) > 0, clave
```

- [ ] **Step 6: Correr el test para verificar que pasa**

Run: `pytest tests/test_etl_hechos.py`
Expected: PASS, los 7.

- [ ] **Step 7: Regenerar los parquet**

Run: `python -m scripts.preparar_datos`
Expected: 18 tablas impresas; las tres de hechos con 109.458, 141.816 y 126.304 filas, y las 12 de soporte con sus conteos.

- [ ] **Step 8: Commit**

```bash
git add backend/scripts/preparar_datos.py backend/tests/test_etl_hechos.py backend/data/curated/
git commit -m "feat: ETL de hechos de liquidacion y tablas de soporte

Evolucion mensual, cruce bilateral y desglose unificado de LVTP, SST-SCT
y LSCIO. Los montos, que el kit entrega como texto, pasan a float64.
Las tablas de soporte conservan las claves exactas que AgentService e
IntegrityService leen por nombre."
```

---

### Task 7: ETL — revisiones y calendario de publicaciones

El módulo diferenciador del spec. `calendario_publicaciones.json` viene anidado (cada fila trae una lista `revisiones`) y hay que aplanarlo.

**Files:**
- Modify: `backend/scripts/preparar_datos.py`
- Test: `backend/tests/test_etl_revisiones.py`

**Interfaces:**
- Consumes: `leer_json`, `a_float`, `escribir`.
- Produces:
  - `construir_fact_revisiones() -> pd.DataFrame` (detalle por valorización)
  - `construir_fact_revisiones_totales() -> pd.DataFrame` (rollup)
  - `construir_fact_calendario() -> pd.DataFrame` (aplanado, una fila por revisión)

- [ ] **Step 1: Escribir el test que falla**

`backend/tests/test_etl_revisiones.py`:

```python
import pandas as pd

from scripts.preparar_datos import (
    construir_fact_revisiones,
    construir_fact_revisiones_totales,
    construir_fact_calendario,
)

PROCESOS = {"LVTA", "LVTP", "LSCIO", "SST-SCT"}


def test_fact_revisiones_tiene_el_detalle_por_valorizacion():
    revisiones = construir_fact_revisiones()

    assert len(revisiones) == 29_875
    assert set(revisiones["proceso"]) == PROCESOS
    assert pd.api.types.is_float_dtype(revisiones["monto"])


def test_no_expone_el_ruc_anonimizado():
    revisiones = construir_fact_revisiones()

    assert "emprruc" not in revisiones.columns


def test_fact_revisiones_totales_es_el_rollup():
    totales = construir_fact_revisiones_totales()

    assert len(totales) == 16_925
    assert pd.api.types.is_float_dtype(totales["monto_total"])


def test_cada_periodo_tiene_exactamente_una_ultima_revision():
    totales = construir_fact_revisiones_totales()

    ultimas = totales[totales["es_ultima_revision"]]
    duplicadas = ultimas.duplicated(
        subset=["proceso", "emprcodi", "pericodi"]
    ).sum()

    assert duplicadas == 0


def test_el_calendario_queda_aplanado():
    calendario = construir_fact_calendario()

    assert "revisiones" not in calendario.columns
    assert {
        "proceso",
        "pericodi",
        "revision",
        "revision_nombre",
        "publicacion_pericodi",
    } <= set(calendario.columns)
    assert len(calendario) > 80


def test_cada_revision_se_publica_una_sola_vez():
    calendario = construir_fact_calendario()

    duplicadas = calendario.duplicated(
        subset=["proceso", "pericodi", "revision"]
    ).sum()

    assert duplicadas == 0
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pytest tests/test_etl_revisiones.py`
Expected: FAIL con `ImportError: cannot import name 'construir_fact_revisiones'`.

- [ ] **Step 3: Escribir la implementación**

Agregar a `backend/scripts/preparar_datos.py`:

```python
def construir_fact_revisiones() -> pd.DataFrame:
    """Detalle del historial R0-R4 por proceso, empresa, periodo y valorizacion.

    Ojo: 'monto' es el monto restatado completo del mes, no el ajuste.
    Sumar montos de varias revisiones del mismo periodo es doble
    contabilidad. El ajuste es la diferencia contra la revision anterior.
    """
    revisiones = pd.DataFrame(
        leer_json("revisiones/revisiones_por_valorizacion.json")
    )
    revisiones["monto"] = a_float(revisiones["monto"])

    # emprruc es el RUC anonimizado del kit; no aporta y no debe viajar.
    return revisiones.drop(columns=["emprruc"], errors="ignore")


def construir_fact_revisiones_totales() -> pd.DataFrame:
    """Rollup del historial por proceso, empresa, periodo y revision."""
    totales = pd.DataFrame(leer_json("revisiones/revisiones_totales.json"))
    totales["monto_total"] = a_float(totales["monto_total"])

    return totales


def construir_fact_calendario() -> pd.DataFrame:
    """Aplana el calendario: una fila por (proceso, periodo, revision).

    El JSON trae una lista anidada 'revisiones' por cada par
    proceso-periodo; aqui se explota a filas.
    """
    crudo = leer_json("revisiones/calendario_publicaciones.json")

    filas = []

    for entrada in crudo:
        for revision in entrada["revisiones"]:
            filas.append(
                {
                    "proceso": entrada["proceso"],
                    "pericodi": entrada["pericodi"],
                    "perianiomes": entrada["perianiomes"],
                    "revision": revision["revision"],
                    "revision_nombre": revision["revision_nombre"],
                    "publicacion_pericodi": revision["publicacion_pericodi"],
                    "publicacion_perianiomes": revision[
                        "publicacion_perianiomes"
                    ],
                }
            )

    return pd.DataFrame(filas)
```

Y extender `main()` agregando, después del bloque de hechos:

```python
    print("Construyendo revisiones...")
    escribir(construir_fact_revisiones(), "fact_revisiones")
    escribir(construir_fact_revisiones_totales(), "fact_revisiones_totales")
    escribir(construir_fact_calendario(), "fact_calendario")
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pytest tests/test_etl_revisiones.py`
Expected: PASS, los 6.

- [ ] **Step 5: Regenerar los parquet**

Run: `python -m scripts.preparar_datos`
Expected: nueve tablas; las de revisiones con 29.875 y 16.925 filas, y el calendario aplanado con más de 80.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/preparar_datos.py backend/tests/test_etl_revisiones.py backend/data/curated/
git commit -m "feat: ETL del historial de revisiones y el calendario

Es el dataset que resuelve el problema declarado en el README y que no
estaba implementado. El calendario venia anidado y aqui queda aplanado
a una fila por (proceso, periodo, revision)."
```

---

### Task 8: ETL — agregados de los datasets pesados

Los cuatro datasets grandes (retiros 398k, costos marginales 140k, curva 15 min 166k, entregas 88k) no se sirven crudos: se preagregan a lo que la UI muestra. Es lo que permite arrancar en segundos y caber en los 512 MB del free tier.

**Files:**
- Modify: `backend/scripts/preparar_datos.py`
- Test: `backend/tests/test_etl_agregados.py`

**Interfaces:**
- Consumes: `leer_json`, `a_float`, `escribir`.
- Produces:
  - `construir_agg_cmg_diario() -> pd.DataFrame` — CMg promedio por período y día
  - `construir_agg_perfil_intradia() -> pd.DataFrame` — CMg promedio por período e intervalo de 15 min
  - `construir_agg_energia_diaria() -> pd.DataFrame` — entregas y retiros por período y día

- [ ] **Step 1: Escribir el test que falla**

`backend/tests/test_etl_agregados.py`:

```python
import pandas as pd

from scripts.preparar_datos import (
    construir_agg_cmg_diario,
    construir_agg_perfil_intradia,
    construir_agg_energia_diaria,
)


def test_cmg_diario_es_mucho_mas_chico_que_el_crudo():
    cmg = construir_agg_cmg_diario()

    # El crudo son 140.199 filas por barra y dia; el agregado es por
    # periodo y dia, asi que debe caber en menos de 1.000.
    assert len(cmg) < 1_000
    assert {"pericodi", "dia", "cmg_promedio"} <= set(cmg.columns)
    assert pd.api.types.is_float_dtype(cmg["cmg_promedio"])


def test_perfil_intradia_tiene_los_96_intervalos():
    perfil = construir_agg_perfil_intradia()

    assert perfil["intervalo"].nunique() == 96
    assert {"pericodi", "intervalo", "cmg_promedio"} <= set(perfil.columns)


def test_energia_diaria_separa_entregas_de_retiros():
    energia = construir_agg_energia_diaria()

    assert {"pericodi", "dia", "entregas", "retiros"} <= set(energia.columns)
    assert len(energia) < 1_000


def test_los_agregados_conservan_el_origen():
    for construir in (
        construir_agg_cmg_diario,
        construir_agg_perfil_intradia,
        construir_agg_energia_diaria,
    ):
        tabla = construir()
        assert "origen" in tabla.columns
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pytest tests/test_etl_agregados.py`
Expected: FAIL con `ImportError: cannot import name 'construir_agg_cmg_diario'`.

- [ ] **Step 3: Escribir la implementación**

Agregar a `backend/scripts/preparar_datos.py`:

```python
def _origen_dominante(serie: pd.Series) -> str:
    """Un grupo es sintetico si cualquiera de sus filas lo es."""
    return "sintetico" if (serie == "sintetico").any() else "real"


def construir_agg_cmg_diario() -> pd.DataFrame:
    """Costo marginal medio del sistema por periodo y dia."""
    crudo = pd.DataFrame(
        leer_json(
            "reportes_intermedios/costos_marginales/"
            "historico_diario_extendido.json"
        )
    )
    crudo["promedio"] = a_float(crudo["promedio"])

    agregado = (
        crudo.groupby(["pericodi", "dia"], as_index=False)
        .agg(
            cmg_promedio=("promedio", "mean"),
            barras=("barrcodi", "nunique"),
            origen=("origen", _origen_dominante),
        )
        .sort_values(["pericodi", "dia"])
        .reset_index(drop=True)
    )

    return agregado


def construir_agg_perfil_intradia() -> pd.DataFrame:
    """Perfil medio del dia: CMg por periodo y por intervalo de 15 minutos."""
    crudo = pd.DataFrame(
        leer_json(
            "reportes_intermedios/costos_marginales/"
            "curva_15min_muestra_extendido.json"
        )
    )
    crudo["valor"] = a_float(crudo["valor"])

    agregado = (
        crudo.groupby(["pericodi", "intervalo"], as_index=False)
        .agg(
            cmg_promedio=("valor", "mean"),
            hora_fin=("hora_fin", "first"),
            origen=("origen", _origen_dominante),
        )
        .sort_values(["pericodi", "intervalo"])
        .reset_index(drop=True)
    )

    return agregado


def construir_agg_energia_diaria() -> pd.DataFrame:
    """Energia entregada y retirada por periodo y dia, en una sola tabla."""
    entregas_crudo = pd.DataFrame(
        leer_json(
            "reportes_intermedios/entregas_retiros/"
            "entregas_historico_diario_extendido.json"
        )
    )
    entregas_crudo["valor"] = a_float(entregas_crudo["valor"])

    retiros_crudo = pd.DataFrame(
        leer_json(
            "reportes_intermedios/entregas_retiros/"
            "retiros_historico_diario_extendido.json"
        )
    )
    retiros_crudo["valor"] = a_float(retiros_crudo["valor"])

    entregas = (
        entregas_crudo.groupby(["pericodi", "dia"], as_index=False)
        .agg(entregas=("valor", "sum"), origen=("origen", _origen_dominante))
    )

    retiros = (
        retiros_crudo.groupby(["pericodi", "dia"], as_index=False)
        .agg(retiros=("valor", "sum"))
    )

    energia = entregas.merge(retiros, on=["pericodi", "dia"], how="outer")
    energia[["entregas", "retiros"]] = energia[
        ["entregas", "retiros"]
    ].fillna(0.0)
    energia["origen"] = energia["origen"].fillna("sintetico")

    return energia.sort_values(["pericodi", "dia"]).reset_index(drop=True)
```

Extender `main()` con:

```python
    print("Construyendo agregados...")
    escribir(construir_agg_cmg_diario(), "agg_cmg_diario")
    escribir(construir_agg_perfil_intradia(), "agg_perfil_intradia")
    escribir(construir_agg_energia_diaria(), "agg_energia_diaria")
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pytest tests/test_etl_agregados.py`
Expected: PASS, los 4.

- [ ] **Step 5: Regenerar todo y medir el peso**

Run:
```bash
python -m scripts.preparar_datos
python -c "import pathlib; print(sum(p.stat().st_size for p in pathlib.Path('data/curated').glob('*.parquet'))/1e6, 'MB')"
```
Expected: 24 tablas impresas y un total bajo 120 MB, frente a los 406 MB del crudo.

- [ ] **Step 6: Commit**

```bash
git add backend/scripts/preparar_datos.py backend/tests/test_etl_agregados.py backend/data/curated/
git commit -m "feat: ETL de agregados de los datasets pesados

CMg diario, perfil intradia de 96 intervalos y energia entregada/retirada
por dia. Preagregar evita cargar 800k filas crudas al arrancar, que es lo
que no cabe en los 512 MB de RAM del free tier."
```

---

### Task 9: El loader lee parquet

Aquí se reparan los tests de caracterización que la Task 4 dejó en rojo.

**Files:**
- Modify: `backend/app/data/loader.py` (reescritura completa)
- Test: `backend/tests/test_loader.py`

**Interfaces:**
- Consumes: los parquet de las tareas 5-8.
- Produces: `cargar_datos_coes() -> dict[str, pd.DataFrame]` con las claves que `main.py`, `IntegrityService` y `AgentService` ya esperan, más las nuevas de revisiones.

- [ ] **Step 1: Confirmar el inventario de claves en uso**

El contrato ya está inventariado y codificado en el test del Step 2. Este comando lo reconfirma por si la limpieza de la Task 2 cambió algo:

```bash
grep -rhno 'datos_coes\["[a-z_]*"\]\|datos\["[a-z_]*"\]\|self\.datos\["[a-z_]*"\]' app/ | grep -o '"[a-z_]*"' | sort -u
```

Expected: un subconjunto de `CLAVES_DEL_CONTRATO_EXISTENTE` del Step 2. Si aparece una clave que no está ahí, agregarla a `TABLAS` en el Step 4 y a `TABLAS_SOPORTE` en la Task 6, o el arranque falla.

- [ ] **Step 2: Escribir el test que falla**

`backend/tests/test_loader.py`:

```python
import pandas as pd

from app.data.loader import cargar_datos_coes

# Contrato que AgentService, IntegrityService y los routers leen por nombre.
CLAVES_DEL_CONTRATO_EXISTENTE = {
    "periodos",
    "empresas",
    "evolucion_liquidaciones",
    "energia_transferencias",
    "lscio_transferencias",
    "lscio_desglose",
    "potencia_desglose",
    "potencia_saldos",
    "sstsct_desglose",
    "costos_marginales_diario",
    "entregas",
    "retiros",
    "puntos_entrega",
}

CLAVES_NUEVAS = {
    "barras",
    "cruce_bilateral",
    "desglose",
    "revisiones",
    "revisiones_totales",
    "calendario",
    "cmg_diario",
    "perfil_intradia",
    "energia_diaria",
}

CLAVES_ESPERADAS = CLAVES_DEL_CONTRATO_EXISTENTE | CLAVES_NUEVAS


def test_carga_todas_las_claves_esperadas():
    datos = cargar_datos_coes()

    assert CLAVES_ESPERADAS <= set(datos)


def test_todo_lo_cargado_es_dataframe():
    datos = cargar_datos_coes()

    for clave, tabla in datos.items():
        assert isinstance(tabla, pd.DataFrame), clave
        assert len(tabla) > 0, clave


def test_los_periodos_cubren_veinte_meses():
    datos = cargar_datos_coes()

    assert len(datos["periodos"]) == 20


def test_las_empresas_traen_alias():
    datos = cargar_datos_coes()

    assert "alias" in datos["empresas"].columns
```

- [ ] **Step 3: Correr el test para verificar que falla**

Run: `pytest tests/test_loader.py`
Expected: FAIL — `loader.py` todavía apunta a `data/coes/*.json`, que la Task 4 eliminó.

- [ ] **Step 4: Reescribir `loader.py`**

Reemplazar el contenido completo de `backend/app/data/loader.py` por:

```python
"""Carga la capa parquet curada.

Los datos crudos del welcome kit viven en data/raw/ (fuera de git) y se
convierten con `python -m scripts.preparar_datos`. El backend nunca lee
JSON crudo: solo parquet.
"""

from functools import lru_cache
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[2]
CURATED = BASE_DIR / "data" / "curated"

# clave en memoria -> nombre del parquet.
#
# Las claves del primer bloque las leen AgentService e IntegrityService por
# nombre; renombrarlas obliga a reescribir ambos servicios.
TABLAS = {
    # contrato existente
    "periodos": "dim_periodo",
    "empresas": "dim_empresa",
    "evolucion_liquidaciones": "fact_evolucion",
    "energia_transferencias": "energia_transferencias",
    "energia_saldos": "energia_saldos",
    "lscio_transferencias": "lscio_transferencias",
    "lscio_desglose": "lscio_desglose",
    "lscio_saldos": "lscio_saldos",
    "potencia_desglose": "potencia_desglose",
    "potencia_saldos": "potencia_saldos",
    "sstsct_desglose": "sstsct_desglose",
    "costos_marginales_diario": "costos_marginales_diario",
    "entregas": "entregas",
    "retiros": "retiros",
    "puntos_entrega": "puntos_entrega",
    # nuevas de esta fase
    "barras": "dim_barra",
    "cruce_bilateral": "fact_bilateral",
    "desglose": "fact_desglose",
    "revisiones": "fact_revisiones",
    "revisiones_totales": "fact_revisiones_totales",
    "calendario": "fact_calendario",
    "cmg_diario": "agg_cmg_diario",
    "perfil_intradia": "agg_perfil_intradia",
    "energia_diaria": "agg_energia_diaria",
}


def cargar_tabla(nombre: str) -> pd.DataFrame:
    ruta = CURATED / f"{nombre}.parquet"

    if not ruta.exists():
        raise FileNotFoundError(
            f"Falta {ruta}. Genera la capa curada con: "
            f"python -m scripts.preparar_datos"
        )

    return pd.read_parquet(ruta)


@lru_cache(maxsize=1)
def cargar_datos_coes() -> dict[str, pd.DataFrame]:
    """Carga la capa curada una sola vez por proceso.

    AgentService llama a esta funcion en su __init__ y cada router la
    llama al importarse. Sin el cache, los mismos datos se cargarian
    cuatro veces y no cabrian en los 512 MB del free tier.
    """
    return {
        clave: cargar_tabla(nombre)
        for clave, nombre in TABLAS.items()
    }
```

- [ ] **Step 5: Verificar que el cache evita la carga múltiple**

Agregar a `backend/tests/test_loader.py`:

```python
def test_los_datos_se_cargan_una_sola_vez():
    """Sin cache, cuatro consumidores cargarian cuatro copias en RAM."""
    primera = cargar_datos_coes()
    segunda = cargar_datos_coes()

    assert primera is segunda
```

- [ ] **Step 6: Correr los tests del loader y los de caracterización**

Run: `pytest tests/test_loader.py tests/test_caracterizacion.py`
Expected: PASS. Los de caracterización vuelven a verde: el backend ya sirve desde parquet.

- [ ] **Step 7: Medir el arranque**

Run: `python -c "import time; t=time.time(); from app.data.loader import cargar_datos_coes; cargar_datos_coes(); print(f'{time.time()-t:.1f} s')"`
Expected: menos de 5 segundos.

- [ ] **Step 8: Commit**

```bash
git add backend/app/data/loader.py backend/tests/test_loader.py
git commit -m "refactor: el loader lee parquet en vez de JSON crudo

Arranque de ~40 s a menos de 5, y el backend deja de necesitar los
406 MB de JSON. Agrega las claves de revisiones y agregados."
```

---

### Task 10: `revision_service.py` y su router

El módulo diferenciador del spec: responde qué trae cada publicación mensual, cómo evolucionó un monto de R0 a R4, y cuánto dinero de meses anteriores entra en una publicación.

**Files:**
- Create: `backend/app/services/revision_service.py`
- Create: `backend/app/routers/__init__.py`
- Create: `backend/app/routers/revisiones.py`
- Modify: `backend/app/main.py` (registrar el router)
- Test: `backend/tests/test_revision_service.py`

**Interfaces:**
- Consumes: `cargar_datos_coes()` de Task 9, claves `revisiones`, `revisiones_totales`, `calendario`.
- Produces:
  - `RevisionService(datos: dict[str, pd.DataFrame])`
  - `.calendario_de_publicacion(publicacion_pericodi: int) -> list[dict]`
  - `.cascada(empresa_id: str, pericodi: int) -> list[dict]` — una entrada por revisión, con `monto_total`, `ajuste` y `ajuste_pct`
  - `.impacto_de_publicacion(publicacion_pericodi: int) -> dict`
  - Router con prefijo `/revisiones`

- [ ] **Step 1: Escribir el test que falla**

`backend/tests/test_revision_service.py`:

```python
import pytest

from app.data.loader import cargar_datos_coes
from app.services.revision_service import RevisionService

PUBLICACION_DEMO = 138
EMPRESA_DEMO = "EMPRESA_001"
PERIODO_DEMO = 132


@pytest.fixture(scope="module")
def servicio():
    return RevisionService(cargar_datos_coes())


def test_el_calendario_lista_lo_que_trae_una_publicacion(servicio):
    entradas = servicio.calendario_de_publicacion(PUBLICACION_DEMO)

    assert len(entradas) > 0
    assert {"proceso", "pericodi", "revision"} <= set(entradas[0])

    # Una publicacion trae la R0 de su propio mes.
    propias = [
        e for e in entradas
        if e["pericodi"] == PUBLICACION_DEMO and e["revision"] == 0
    ]
    assert len(propias) > 0


def test_la_cascada_devuelve_las_revisiones_en_orden(servicio):
    cascada = servicio.cascada(EMPRESA_DEMO, PERIODO_DEMO)

    assert len(cascada) > 0
    revisiones = [paso["revision"] for paso in cascada]
    assert revisiones == sorted(revisiones)


def test_la_primera_revision_no_tiene_ajuste(servicio):
    cascada = servicio.cascada(EMPRESA_DEMO, PERIODO_DEMO)
    primera = cascada[0]

    assert primera["revision"] == 0
    assert primera["ajuste"] is None
    assert primera["ajuste_pct"] is None


def test_el_ajuste_es_la_diferencia_contra_la_revision_anterior(servicio):
    cascada = servicio.cascada(EMPRESA_DEMO, PERIODO_DEMO)

    for anterior, actual in zip(cascada, cascada[1:]):
        esperado = actual["monto_total"] - anterior["monto_total"]
        assert actual["ajuste"] == pytest.approx(esperado, abs=1e-6)


def test_una_empresa_sin_revisiones_devuelve_lista_vacia(servicio):
    assert servicio.cascada("EMPRESA_INEXISTENTE", PERIODO_DEMO) == []


def test_el_impacto_separa_el_mes_corriente_de_los_arrastres(servicio):
    impacto = servicio.impacto_de_publicacion(PUBLICACION_DEMO)

    assert {"corriente", "arrastre", "periodos_arrastrados"} <= set(impacto)
    assert impacto["periodos_arrastrados"] >= 0
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pytest tests/test_revision_service.py`
Expected: FAIL con `ModuleNotFoundError: No module named 'app.services.revision_service'`.

- [ ] **Step 3: Escribir el servicio**

`backend/app/services/revision_service.py`:

```python
"""Trazabilidad del ciclo de revisiones de liquidaciones.

COES no publica una liquidacion una sola vez: la publicacion de un mes
trae la R0 de ese mes mas recalculos de meses anteriores. Este servicio
expone ese ciclo.

Regla de dominio: 'monto_total' es el monto restatado completo del mes,
no el ajuste. El ajuste es la diferencia contra la revision anterior, y
por eso se calcula aqui en vez de sumarse desde los datos.
"""

import pandas as pd


class RevisionService:

    def __init__(self, datos: dict[str, pd.DataFrame]):
        self.revisiones = datos["revisiones"]
        self.totales = datos["revisiones_totales"]
        self.calendario = datos["calendario"]

    def calendario_de_publicacion(
        self, publicacion_pericodi: int
    ) -> list[dict]:
        """Que liquidaciones salen en la publicacion de un mes."""
        entradas = self.calendario[
            self.calendario["publicacion_pericodi"] == publicacion_pericodi
        ]

        entradas = entradas.sort_values(
            ["proceso", "pericodi", "revision"]
        )

        return entradas.to_dict(orient="records")

    def cascada(self, empresa_id: str, pericodi: int) -> list[dict]:
        """La cadena R0 -> R4 de un mes, con el ajuste de cada salto."""
        filas = self.totales[
            (self.totales["emprcodi"] == empresa_id)
            & (self.totales["pericodi"] == pericodi)
        ]

        if filas.empty:
            return []

        # Un mes puede tener varios procesos; se consolidan por revision.
        consolidado = (
            filas.groupby(
                ["revision", "revision_nombre"], as_index=False
            )
            .agg(
                monto_total=("monto_total", "sum"),
                procesos=("proceso", "nunique"),
                publicacion_pericodi=("publicacion_pericodi", "min"),
                origen=("origen", "first"),
            )
            .sort_values("revision")
            .reset_index(drop=True)
        )

        pasos = []
        monto_anterior = None

        for fila in consolidado.to_dict(orient="records"):
            monto = float(fila["monto_total"])

            if monto_anterior is None:
                ajuste = None
                ajuste_pct = None
            else:
                ajuste = monto - monto_anterior
                ajuste_pct = (
                    ajuste / abs(monto_anterior)
                    if monto_anterior != 0
                    else None
                )

            pasos.append(
                {
                    "revision": int(fila["revision"]),
                    "revision_nombre": fila["revision_nombre"],
                    "monto_total": monto,
                    "ajuste": ajuste,
                    "ajuste_pct": ajuste_pct,
                    "procesos": int(fila["procesos"]),
                    "publicacion_pericodi": int(
                        fila["publicacion_pericodi"]
                    ),
                    "origen": fila["origen"],
                }
            )

            monto_anterior = monto

        return pasos

    def impacto_de_publicacion(
        self, publicacion_pericodi: int
    ) -> dict:
        """Cuanto de una publicacion es del mes y cuanto viene arrastrado."""
        filas = self.totales[
            self.totales["publicacion_pericodi"] == publicacion_pericodi
        ]

        if filas.empty:
            return {
                "publicacion_pericodi": publicacion_pericodi,
                "corriente": 0.0,
                "arrastre": 0.0,
                "periodos_arrastrados": 0,
            }

        del_mes = filas[filas["pericodi"] == publicacion_pericodi]
        arrastradas = filas[filas["pericodi"] != publicacion_pericodi]

        return {
            "publicacion_pericodi": publicacion_pericodi,
            "corriente": float(del_mes["monto_total"].sum()),
            "arrastre": float(arrastradas["monto_total"].sum()),
            "periodos_arrastrados": int(arrastradas["pericodi"].nunique()),
        }
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pytest tests/test_revision_service.py`
Expected: PASS, los 6.

- [ ] **Step 5: Crear el router y registrarlo**

`backend/app/routers/__init__.py`: archivo vacío.

`backend/app/routers/revisiones.py`:

```python
from fastapi import APIRouter, HTTPException

from app.data.loader import cargar_datos_coes
from app.services.revision_service import RevisionService

router = APIRouter(prefix="/revisiones", tags=["revisiones"])

_servicio = RevisionService(cargar_datos_coes())


@router.get("/calendario/{publicacion_pericodi}")
def calendario(publicacion_pericodi: int):
    entradas = _servicio.calendario_de_publicacion(publicacion_pericodi)

    if not entradas:
        raise HTTPException(
            status_code=404,
            detail=(
                f"No hay publicacion registrada para el periodo "
                f"{publicacion_pericodi}."
            ),
        )

    return {"publicacion_pericodi": publicacion_pericodi,
            "entradas": entradas}


@router.get("/cascada/{empresa_id}/{pericodi}")
def cascada(empresa_id: str, pericodi: int):
    pasos = _servicio.cascada(empresa_id, pericodi)

    if not pasos:
        raise HTTPException(
            status_code=404,
            detail=(
                f"Sin historial de revisiones para {empresa_id} "
                f"en el periodo {pericodi}."
            ),
        )

    return {
        "empresa_id": empresa_id,
        "pericodi": pericodi,
        "pasos": pasos,
    }


@router.get("/impacto/{publicacion_pericodi}")
def impacto(publicacion_pericodi: int):
    return _servicio.impacto_de_publicacion(publicacion_pericodi)
```

En `backend/app/main.py`, después de la configuración de CORS, agregar:

```python
from app.routers import revisiones

app.include_router(revisiones.router)
```

- [ ] **Step 6: Escribir el test del router**

Agregar al final de `backend/tests/test_revision_service.py`:

```python
def test_endpoint_calendario(cliente):
    respuesta = cliente.get(f"/revisiones/calendario/{PUBLICACION_DEMO}")

    assert respuesta.status_code == 200
    assert len(respuesta.json()["entradas"]) > 0


def test_endpoint_cascada(cliente):
    respuesta = cliente.get(
        f"/revisiones/cascada/{EMPRESA_DEMO}/{PERIODO_DEMO}"
    )

    assert respuesta.status_code == 200
    assert len(respuesta.json()["pasos"]) > 0


def test_endpoint_cascada_de_empresa_inexistente_es_404(cliente):
    respuesta = cliente.get(f"/revisiones/cascada/EMPRESA_NADA/{PERIODO_DEMO}")

    assert respuesta.status_code == 404


def test_endpoint_impacto(cliente):
    respuesta = cliente.get(f"/revisiones/impacto/{PUBLICACION_DEMO}")

    assert respuesta.status_code == 200
    assert "arrastre" in respuesta.json()
```

- [ ] **Step 7: Correr toda la suite**

Run: `pytest`
Expected: PASS, todo.

- [ ] **Step 8: Commit**

```bash
git add backend/app/services/revision_service.py backend/app/routers/ backend/app/main.py backend/tests/test_revision_service.py
git commit -m "feat: servicio y router de revisiones

Expone el calendario de publicaciones, la cascada R0-R4 con el ajuste de
cada salto, y cuanto de una publicacion viene arrastrado de meses
anteriores. El ajuste se calcula como diferencia contra la revision
anterior: sumar montos de varias revisiones seria doble contabilidad."
```

---

### Task 11: Dividir `main.py` en routers

**Files:**
- Create: `backend/app/routers/catalogos.py`, `backend/app/routers/panorama.py`, `backend/app/routers/empresa.py`
- Modify: `backend/app/main.py` (queda como ensamblador)

**Interfaces:**
- Consumes: los servicios ya existentes y el router de revisiones de Task 10.
- Produces: `main.py` por debajo de 80 líneas, con `app`, CORS, `/`, `/health` y el registro de routers.

- [ ] **Step 1: Mover `/periodos` y `/empresas` a `catalogos.py`**

`backend/app/routers/catalogos.py`:

```python
from fastapi import APIRouter

from app.data.loader import cargar_datos_coes

router = APIRouter(tags=["catalogos"])

_datos = cargar_datos_coes()


@router.get("/periodos")
def obtener_periodos():
    return {
        "periodos": _datos["periodos"].to_dict(orient="records")
    }


@router.get("/empresas")
def obtener_empresas():
    return {
        "empresas": _datos["empresas"].to_dict(orient="records")
    }
```

- [ ] **Step 2: Mover `/radar/{fecha}` a `panorama.py`**

Es un movimiento literal, no una reescritura. Procedimiento exacto:

1. Crear `backend/app/routers/panorama.py` con este encabezado:

```python
from fastapi import APIRouter, HTTPException
import pandas as pd

from app.analysis import calcular_score_relevancia
from app.data.loader import cargar_datos_coes

router = APIRouter(tags=["panorama"])

datos_coes = cargar_datos_coes()
```

2. Cortar de `main.py` el bloque completo de la función `radar` — desde la línea `@app.get("/radar/{fecha}")` hasta la última línea de su `return`, que en el archivo original son las líneas 287-695 — y pegarlo al final de `panorama.py`.

3. En el bloque pegado, cambiar la única línea del decorador:

```python
@app.get("/radar/{fecha}")     # antes
@router.get("/radar/{fecha}")  # despues
```

No tocar nada más del cuerpo. El test `test_radar_de_un_periodo_valido` de la Task 1 verifica que el movimiento no cambió el comportamiento.

- [ ] **Step 3: Mover los `/agente/*` a `empresa.py`**

Copiar los 14 endpoints `/agente/*` de `main.py` a `backend/app/routers/empresa.py`, con este encabezado:

```python
from fastapi import APIRouter, HTTPException

from app.data.loader import cargar_datos_coes
from app.services.agent_service import AgentService
from app.services.integrity_service import IntegrityService

router = APIRouter(tags=["empresa"])

datos_coes = cargar_datos_coes()
agent_service = AgentService()
integrity_service = IntegrityService(datos_coes)
```

`AgentService()` no recibe argumentos: llama a `cargar_datos_coes()` en su propio `__init__`. Gracias al `lru_cache` de la Task 9, eso ya no duplica los datos en memoria.

Reemplazar cada `@app.get(...)` por `@router.get(...)`. No cambiar ninguna ruta ni ningún cuerpo: es un movimiento, no una reescritura.

- [ ] **Step 4: Dejar `main.py` como ensamblador**

`backend/app/main.py` completo:

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routers import catalogos, empresa, panorama, revisiones

app = FastAPI(
    title="COES Liquidaciones 360",
    description=(
        "API para consulta, analisis y trazabilidad "
        "de liquidaciones del mercado electrico peruano."
    ),
    version="1.0.0",
)

origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(catalogos.router)
app.include_router(panorama.router)
app.include_router(empresa.router)
app.include_router(revisiones.router)


@app.get("/")
def raiz():
    return {
        "servicio": "COES Liquidaciones 360",
        "version": app.version,
        "documentacion": "/docs",
    }


@app.get("/health")
def health():
    return {"estado": "ok"}
```

- [ ] **Step 5: Correr toda la suite**

Run: `pytest`
Expected: PASS, todo. Los tests de caracterización son la prueba de que el movimiento no cambió ninguna ruta.

- [ ] **Step 6: Verificar el tamaño de `main.py`**

Run: `python -c "print(len(open('app/main.py',encoding='utf-8').readlines()))"`
Expected: menos de 80 líneas, frente a 1.267.

- [ ] **Step 7: Commit**

```bash
git add backend/app/
git commit -m "refactor: dividir main.py en routers por dominio

main.py pasa de 1.267 lineas a menos de 80 y queda como ensamblador.
Los endpoints se mueven sin cambiar rutas ni cuerpos; los tests de
caracterizacion lo verifican."
```

---

### Task 12: Preparar el despliegue

**Files:**
- Create: `backend/render.yaml`
- Modify: `backend/app/main.py` (CORS por variable de entorno)
- Modify: `README.md` (instrucciones actualizadas)
- Test: `backend/tests/test_despliegue.py`

**Interfaces:**
- Consumes: la app de Task 11.
- Produces: `origenes_permitidos() -> list[str]` en `main.py`, leída de `CORS_ORIGINS`.

- [ ] **Step 1: Escribir el test que falla**

`backend/tests/test_despliegue.py`:

```python
import importlib


def test_cors_por_defecto_permite_el_dev_local(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)

    from app import main
    importlib.reload(main)

    assert "http://localhost:5173" in main.origenes_permitidos()


def test_cors_se_configura_por_variable_de_entorno(monkeypatch):
    monkeypatch.setenv(
        "CORS_ORIGINS",
        "https://coes.vercel.app,https://otro.app",
    )

    from app import main
    importlib.reload(main)

    origenes = main.origenes_permitidos()

    assert "https://coes.vercel.app" in origenes
    assert "https://otro.app" in origenes


def test_health_no_toca_los_datos(cliente):
    """El keep-alive se llama cada 10 min; debe ser barato."""
    respuesta = cliente.get("/health")

    assert respuesta.status_code == 200
    assert respuesta.json() == {"estado": "ok"}
```

- [ ] **Step 2: Correr el test para verificar que falla**

Run: `pytest tests/test_despliegue.py`
Expected: FAIL con `AttributeError: module 'app.main' has no attribute 'origenes_permitidos'`.

- [ ] **Step 3: Implementar el CORS configurable**

En `backend/app/main.py`, reemplazar la lista fija `origins` por:

```python
import os

ORIGENES_DEV = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]


def origenes_permitidos() -> list[str]:
    """Los origenes de produccion llegan por CORS_ORIGINS, separados por coma."""
    configurados = os.getenv("CORS_ORIGINS", "").strip()

    if not configurados:
        return ORIGENES_DEV

    return ORIGENES_DEV + [
        origen.strip()
        for origen in configurados.split(",")
        if origen.strip()
    ]


app.add_middleware(
    CORSMiddleware,
    allow_origins=origenes_permitidos(),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

- [ ] **Step 4: Correr el test para verificar que pasa**

Run: `pytest tests/test_despliegue.py`
Expected: PASS, los 3.

- [ ] **Step 5: Crear `render.yaml`**

```yaml
services:
  - type: web
    name: coes-liquidaciones-api
    runtime: python
    plan: free
    rootDir: backend
    buildCommand: pip install -r requirements.txt
    startCommand: uvicorn app.main:app --host 0.0.0.0 --port $PORT
    healthCheckPath: /health
    envVars:
      - key: PYTHON_VERSION
        value: "3.13.0"
      - key: CORS_ORIGINS
        sync: false
```

- [ ] **Step 6: Verificar que la app arranca como lo hará en producción**

Run: `uvicorn app.main:app --host 0.0.0.0 --port 8000`
Expected: arranca en menos de 10 segundos. Comprobar `http://localhost:8000/health` y `http://localhost:8000/docs`.

- [ ] **Step 7: Actualizar el README**

En `README.md`, reemplazar la sección "Estructura" por el árbol nuevo (sin `data/coes/`, con `data/curated/`, `scripts/`, `routers/`, `tests/`), y agregar al final de la sección "Backend" el paso de preparación de datos:

```bash
# Una sola vez, antes de levantar la API:
python -m scripts.preparar_datos
```

Actualizar además la sección "Sobre los datos": ya no describe `data_generator.py` ni el CSV, sino el welcome kit, el backcast 2025 (`origen: real | sintetico`) y el alias de empresa como nombre ficticio.

- [ ] **Step 8: Correr toda la suite una última vez**

Run: `pytest`
Expected: PASS, todo.

- [ ] **Step 9: Commit**

```bash
git add backend/render.yaml backend/app/main.py backend/tests/test_despliegue.py README.md
git commit -m "feat: preparar el despliegue del backend

CORS configurable por CORS_ORIGINS, render.yaml con health check en
/health para el keep-alive, y README actualizado con el paso de
preparacion de la capa curada."
```

---

## Verificación final del plan

Al terminar las 12 tareas, estos comandos deben dar los resultados indicados:

| Comando | Resultado esperado |
|---|---|
| `pytest` | Todo en verde, alrededor de 50 tests |
| `python -c "import pathlib; print(sum(len(p.read_text(encoding='utf-8').splitlines()) for p in pathlib.Path('app').rglob('*.py')))"` | ~5.500 líneas, frente a 8.686 |
| `python -c "print(len(open('app/main.py',encoding='utf-8').readlines()))"` | < 80, frente a 1.267 |
| `du -sh data/curated` | < 120 MB, frente a 406 MB de crudo |
| `git status --porcelain data/raw` | vacío — los crudos no se versionan |
| `curl localhost:8000/revisiones/cascada/EMPRESA_001/132` | La cascada R0→R4 con sus ajustes |

## Fuera de alcance de este plan

El frontend completo — reestructuración de `App.jsx`, las 6 secciones, el portado de los renderers SVG y el sistema de diseño unificado — va en el plan `2026-09-15-frontend-unificado.md`, que depende de que este esté terminado.

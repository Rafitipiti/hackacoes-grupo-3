# HACKACOES — Grupo 3 · Automatización del módulo de Liquidaciones

Proyecto del **Grupo 3** de la HACKACOES.

## El problema

Hoy la información de liquidaciones del COES llega a las empresas del sector de forma dispersa y difícil de rastrear:

- **Información fragmentada** — los datos viven en informes, anexos y archivos separados, y armar una vista completa exige juntarlos a mano.
- **Demoras en la búsqueda** — encontrar el detalle de una liquidación puntual puede tomar horas de revisar documentos.
- **Trazabilidad débil** — cuando un monto cambia entre la versión original y sus revisiones (R1, R2), no queda claro qué cambió, cuándo ni por qué.

## La propuesta

Automatizar el módulo de Liquidaciones para **disponibilizar correctamente la información a las distintas empresas del sector**, con:

- Consolidación de las liquidaciones en una sola fuente consultable.
- Trazabilidad extremo a extremo: de cada monto al informe y la revisión que lo originó.
- Búsqueda y filtrado inmediatos, en lugar de rastreo manual entre archivos.
- Análisis de integridad y detección de inconsistencias entre versiones.

## Para el equipo: cómo trabajar con Git

Si es tu primera vez con Git, abre **[`GUIA-GIT.html`](GUIA-GIT.html)** con doble clic. Tiene el paso a paso completo — clonar, crear tu rama, commitear y mergear a master — con botones para copiar cada comando.

Resumen del ciclo:

```bash
git checkout master && git pull          # 1. actualizar
git checkout -b nombre-de-tu-tarea       # 2. tu rama
git add . && git commit -m "Qué hiciste" # 3. guardar
git push -u origin nombre-de-tu-tarea    # 4. subir
git pull origin master                   # 5. traer master antes del pull request
```

Reglas: nunca trabajar directo en `master`, siempre `git pull` antes de empezar, y una rama por tarea.

## Stack

| Capa | Tecnología |
|---|---|
| Frontend | React 19 + Vite 8 · Recharts (gráficos) · Axios (HTTP) · oxlint |
| Backend | Python + FastAPI + Uvicorn · Pydantic |
| Datos y análisis | pandas · numpy · pyarrow |

Node.js se usa únicamente como herramienta de desarrollo del frontend (servidor de desarrollo de Vite y compilación). No hay backend en Node: la API es FastAPI y el frontend compila a archivos estáticos.

## Estructura

```
COES_2026/
├── backend/                API FastAPI
│   ├── app/
│   │   ├── main.py            ensamblador de la app (CORS, routers)
│   │   ├── analysis.py        análisis de liquidaciones
│   │   ├── data/loader.py     carga perezosa de la capa curada
│   │   ├── routers/           endpoints por dominio (catálogos, panorama, empresa, revisiones)
│   │   └── services/          trazabilidad, integridad, agente
│   ├── scripts/
│   │   └── preparar_datos.py  ETL: welcome kit -> data/curated/
│   ├── data/
│   │   ├── raw/                copia de trabajo del welcome kit (no versionada)
│   │   └── curated/             parquet consumidos por la API (sí versionada)
│   └── tests/                pruebas de ETL, servicios y endpoints
├── frontend/                aplicación React + Vite
├── presentacion/            PPT de la exposición
└── COES.txt                 notas de instalación del entorno
```

## Cómo levantarlo

Requisitos: **Python 3.13** y **Node.js**.

### Backend

```bash
cd backend
python -m venv venv
```

Activar el entorno virtual:

```bash
# Windows (PowerShell)
.\venv\Scripts\Activate.ps1

# macOS / Linux
source venv/bin/activate
```

Instalar dependencias:

```bash
pip install -r requirements.txt
```

Preparar la capa de datos curada (una sola vez, antes de levantar la API por primera vez o cuando cambie el welcome kit en `data/raw/`):

```bash
python -m scripts.preparar_datos
```

Levantar la API:

```bash
uvicorn app.main:app --reload
```

La API queda en `http://localhost:8000` y su documentación interactiva en `http://localhost:8000/docs`.

### Frontend

En otra terminal:

```bash
cd frontend
npm install
npm run dev
```

La aplicación queda en `http://localhost:5173`.

## Despliegue

- **Backend en Render**: configurar la variable de entorno `CORS_ORIGINS` con la URL del frontend en Vercel (por ejemplo `https://coes-2026.vercel.app`). Si se omite, el navegador bloquea las respuestas por CORS y el backend no deja rastro del problema en sus propios logs — el error solo aparece en la consola del navegador.
- **Frontend en Vercel**: Root Directory `frontend/`, y variable de entorno `VITE_API_URL` con la URL pública del backend en Render (por ejemplo `https://coes-liquidaciones-api.onrender.com`).

## Pruebas

```bash
cd backend
pytest
```

Los 23 tests de `test_etl_*.py` requieren el welcome kit en `backend/data/raw/` (no versionado). En un clon limpio, sin ese directorio, se saltan automáticamente en vez de fallar.

## Sobre los datos

La fuente de datos ya no es un generador sintético ni un CSV: es el **welcome kit de HackaCOES**, la copia de trabajo del cual vive en `backend/data/raw/` (no se versiona; ver `.gitignore`). El script `python -m scripts.preparar_datos` lo transforma en la capa curada de `backend/data/curated/` (parquet, sí versionada), que es lo único que el backend lee en tiempo de ejecución.

El welcome kit trae datos reales hasta cierto corte y, a partir de ahí, un **backcast 2025**: periodos generados sintéticamente para completar el histórico. Cada periodo indica su procedencia en el campo `origen`, con valor `real` o `sintetico` — así queda explícito qué cifras corresponden a liquidaciones reales del mercado y cuáles son una proyección hacia atrás.

Las empresas se identifican internamente por su clave técnica (`EMPRESA_00X`), la única que participa en cálculos y relaciones. De cara al usuario se muestran con un **alias ficticio** (por ejemplo, `Generadora Andina`) generado de forma determinística a partir de esa clave: no es una re-identificación de la empresa real, solo una etiqueta legible para la demo.

## Equipo

Grupo 3 — HACKACOES.

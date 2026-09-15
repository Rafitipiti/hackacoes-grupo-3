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
| Datos y análisis | pandas · numpy · scikit-learn |

Node.js se usa únicamente como herramienta de desarrollo del frontend (servidor de desarrollo de Vite y compilación). No hay backend en Node: la API es FastAPI y el frontend compila a archivos estáticos.

## Estructura

```
COES_2026/
├── backend/          API FastAPI
│   ├── app/
│   │   ├── main.py            punto de entrada de la API
│   │   ├── analysis.py        análisis de liquidaciones
│   │   ├── ml_model.py        modelo predictivo
│   │   ├── data_generator.py  generador del dataset sintético
│   │   ├── data/              carga de datos
│   │   └── services/          trazabilidad, integridad, analista, agente
│   └── data/coes/    datasets del proyecto (JSON)
├── frontend/         aplicación React + Vite
├── data/             dataset de liquidaciones simuladas (XLSX)
├── presentacion/     PPT de la exposición
└── COES.txt          notas de instalación del entorno
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

Instalar y levantar:

```bash
pip install -r requirements.txt
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

## Sobre los datos

**Todos los datos de este repositorio son sintéticos.** Fueron generados con `backend/app/data_generator.py` (semilla fija) y están marcados como `COES - Dataset Sintético` en la columna `fuente`. Ninguna cifra corresponde a liquidaciones reales ni expone información económica de ninguna empresa del sector.

Los RUC y razones sociales que aparecen en `data/simulado_liquidaciones_COES_2024-09_2026-08.xlsx` son información pública de SUNAT; los montos y la existencia misma de cada relación comercial son inventados.

## Equipo

Grupo 3 — HACKACOES.

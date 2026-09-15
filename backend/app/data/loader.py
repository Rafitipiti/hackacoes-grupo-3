from pathlib import Path
import json
import pandas as pd


# ============================================================
# RUTAS
# ============================================================

BASE_DIR = Path(__file__).resolve().parents[2]

COES_DATA_DIR = BASE_DIR / "data" / "coes"


# ============================================================
# FUNCIONES GENERALES
# ============================================================

def cargar_json(ruta: Path):
    """
    Carga un archivo JSON y devuelve su contenido.
    """
    if not ruta.exists():
        raise FileNotFoundError(f"No se encontró el archivo: {ruta}")

    with open(ruta, "r", encoding="utf-8") as archivo:
        return json.load(archivo)


def cargar_dataframe(ruta: Path) -> pd.DataFrame:
    """
    Carga un JSON compuesto por una lista de objetos
    y lo convierte en DataFrame.
    """
    datos = cargar_json(ruta)

    if not isinstance(datos, list):
        raise ValueError(
            f"Se esperaba una lista de registros en {ruta.name}"
        )

    return pd.DataFrame(datos)


# ============================================================
# CATÁLOGOS COMUNES
# ============================================================

def load_periodos():
    ruta = COES_DATA_DIR / "_catalogos_comunes" / "periodos.json"
    return cargar_dataframe(ruta)


def load_empresas():
    ruta = COES_DATA_DIR / "_catalogos_comunes" / "empresas.json"
    return cargar_dataframe(ruta)


def load_clientes():
    ruta = COES_DATA_DIR / "_catalogos_comunes" / "clientes_retiros.json"
    return cargar_dataframe(ruta)


def load_barras():
    ruta = COES_DATA_DIR / "_catalogos_comunes" / "barras.json"
    return cargar_dataframe(ruta)


# ============================================================
# LIQUIDACIONES
# ============================================================

def load_evolucion_liquidaciones():
    ruta = (
        COES_DATA_DIR
        / "liquidaciones"
        / "evolucion_mensual.json"
    )
    return cargar_dataframe(ruta)


def load_cruce_bilateral():
    ruta = (
        COES_DATA_DIR
        / "liquidaciones"
        / "cruce_bilateral.json"
    )
    return cargar_dataframe(ruta)


# ============================================================
# ENERGÍA ACTIVA
# ============================================================

def load_energia_transferencias():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "energia_activa"
        / "transferencias_por_empresa.json"
    )
    return cargar_dataframe(ruta)


def load_energia_saldos():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "energia_activa"
        / "saldos.json"
    )
    return cargar_dataframe(ruta)


# ============================================================
# POTENCIA
# ============================================================

def load_potencia_desglose():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "potencia"
        / "desglose_por_valorizacion.json"
    )
    return cargar_dataframe(ruta)


def load_potencia_saldos():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "potencia"
        / "saldos.json"
    )
    return cargar_dataframe(ruta)


# ============================================================
# LSCIO
# ============================================================

def load_lscio_transferencias():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "lscio"
        / "transferencias_por_empresa.json"
    )
    return cargar_dataframe(ruta)


def load_lscio_desglose():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "lscio"
        / "desglose_por_mecanismo.json"
    )
    return cargar_dataframe(ruta)


def load_lscio_saldos():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "lscio"
        / "saldos.json"
    )
    return cargar_dataframe(ruta)


# ============================================================
# SST-SCT
# ============================================================

def load_sstsct_desglose():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "sstsct"
        / "desglose_por_valorizacion.json"
    )
    return cargar_dataframe(ruta)


# ============================================================
# COSTOS MARGINALES
# ============================================================

def load_costos_marginales_diario():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "costos_marginales"
        / "historico_diario.json"
    )
    return cargar_dataframe(ruta)


def load_costos_marginales_15min():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "costos_marginales"
        / "curva_15min_muestra.json"
    )
    return cargar_dataframe(ruta)


# ============================================================
# ENTREGAS Y RETIROS
# ============================================================

def load_puntos_entrega():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "entregas_retiros"
        / "puntos_entrega.json"
    )
    return cargar_dataframe(ruta)


def load_entregas():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "entregas_retiros"
        / "entregas_historico_diario.json"
    )
    return cargar_dataframe(ruta)


def load_retiros():
    ruta = (
        COES_DATA_DIR
        / "reportes_intermedios"
        / "entregas_retiros"
        / "retiros_historico_diario.json"
    )
    return cargar_dataframe(ruta)


# ============================================================
# PRUEBA GENERAL DE CARGA
# ============================================================

def cargar_datos_coes():
    """
    Carga todos los datasets principales del paquete COES.

    Devuelve un diccionario con todos los DataFrames.
    """

    return {
        "periodos": load_periodos(),
        "empresas": load_empresas(),
        "clientes": load_clientes(),
        "barras": load_barras(),

        "evolucion_liquidaciones": load_evolucion_liquidaciones(),
        "cruce_bilateral": load_cruce_bilateral(),

        "energia_transferencias": load_energia_transferencias(),
        "energia_saldos": load_energia_saldos(),

        "potencia_desglose": load_potencia_desglose(),
        "potencia_saldos": load_potencia_saldos(),

        "lscio_transferencias": load_lscio_transferencias(),
        "lscio_desglose": load_lscio_desglose(),
        "lscio_saldos": load_lscio_saldos(),

        "sstsct_desglose": load_sstsct_desglose(),

        "costos_marginales_diario": load_costos_marginales_diario(),
        "costos_marginales_15min": load_costos_marginales_15min(),

        "puntos_entrega": load_puntos_entrega(),
        "entregas": load_entregas(),
        "retiros": load_retiros(),
    }


# ============================================================
# DIAGNÓSTICO
# ============================================================

def diagnostico_datos():
    """
    Carga los datasets y muestra cantidad de registros.
    """

    datos = cargar_datos_coes()

    print("\n==============================================")
    print("       DIAGNÓSTICO DE DATOS COES")
    print("==============================================")

    for nombre, df in datos.items():
        print(f"✓ {nombre:<30} {len(df):>8,} registros")

    print("==============================================")
    print(f"Total de datasets cargados: {len(datos)}")
    print("==============================================\n")

    return datos


if __name__ == "__main__":
    diagnostico_datos()

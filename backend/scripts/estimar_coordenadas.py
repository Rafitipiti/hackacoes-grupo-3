"""Estima una coordenada para cada barra del SEIN (spec portal-analitico, D11).

El welcome kit no trae ubicacion de las barras. Aqui se asigna una por el
nombre: se quita la tension ("SOCABAYA 220" -> "SOCABAYA") y se busca la
localidad conocida mas larga contenida en el nombre. Es una ESTIMACION
para dibujar el mapa, no una georreferencia oficial, y asi se declara en
la columna `metodo` y en la seccion Calidad del portal.

Las barras que no se reconocen reciben una posicion nominal en el centro
del pais, con `metodo = "nominal"`, para que el mapa las cuente y las
pinte distinto, en lugar de esconderlas.

Determinista. Ejecutar desde backend/:

    python -m scripts.estimar_coordenadas

Escribe ../data/coordenadas_barras.csv (carpeta data/ del repositorio).
"""

import re
from pathlib import Path

import pandas as pd

BASE_DIR = Path(__file__).resolve().parents[1]
CURATED = BASE_DIR / "data" / "curated"
DESTINO = BASE_DIR.parent / "data" / "coordenadas_barras.csv"

# Localidad -> (lat, lon). Aproximadas al pueblo, central o subestacion.
LOCALIDADES = {
    # Norte
    "ZORRITOS": (-3.68, -80.67), "NCTUMBES": (-3.57, -80.45), "TUMBES": (-3.57, -80.45),
    "TALARA": (-4.58, -81.27), "LA BREA": (-4.62, -81.20), "SUNNY": (-4.75, -81.05),
    "VALLE DEL CHIRA": (-4.90, -80.90), "PLANTAETANOL": (-4.88, -80.72), "BIOENERGIA": (-4.92, -80.80),
    "PIURA OESTE": (-5.19, -80.63), "PIURA": (-5.19, -80.63), "LA NIÑA": (-5.90, -80.50),
    "LANIÑA": (-5.90, -80.50), "LA NI": (-5.90, -80.50),
    "SAN IGNACIO": (-5.15, -78.99), "HUARANGO": (-5.25, -78.90), "JAEN": (-5.71, -78.81),
    "AGROLMOS": (-5.98, -79.75), "CUTERVO": (-6.38, -78.82), "CARHUAQUERO": (-6.55, -79.30),
    "DUNA HUAMBOS": (-6.70, -79.20), "LA RAMADA": (-6.55, -79.85), "CHICLAYO": (-6.77, -79.84),
    "ETEN": (-6.90, -79.87), "RECKA": (-6.90, -79.87), "ZAÑA": (-6.93, -79.58), "ZA": (-6.93, -79.58),
    "CERRO CORONA": (-6.75, -78.60), "MARAÑON": (-6.70, -78.30), "MARA": (-6.70, -78.30),
    "CAJAMARCA": (-7.16, -78.51), "CACLIC": (-7.00, -78.40), "GALLITO CIEGO": (-7.22, -79.17),
    "GUADALUPE": (-7.24, -79.47), "PLANTA CASA GRANDE": (-7.75, -79.19), "SANTIAGO DE CAO": (-7.96, -79.24),
    "TRUJILLO": (-8.11, -79.03), "BELAUNDE": (-8.05, -79.00),
    "PLANTA SAN JACINTO": (-9.14, -78.35), "CHIMBOTE": (-9.08, -78.58),
    "QUITARACSA": (-8.80, -77.87), "HUALLANCA": (-8.82, -77.86), "PARIAC": (-9.55, -77.50),
    "TOCACHE": (-8.19, -76.51), "AUCAYACU": (-8.93, -76.11), "TINGO MARIA": (-9.30, -76.00),
    "PUCALLPA": (-8.38, -74.55), "CT PLANTA PUCALLPA": (-8.40, -74.60), "AGUAYTIA": (-9.04, -75.51),
    "CHAGLLA": (-9.72, -75.90), "HUANUCO": (-9.93, -76.24), "VIZCARRA": (-9.90, -76.70),
    # Centro
    "CAHUA": (-10.67, -77.32), "PARAMONGA": (-10.67, -77.83), "PURMACANA": (-10.90, -77.60),
    "MEDIO MUNDO": (-10.85, -77.66), "CHEVES": (-11.00, -76.90), "YARUCAYA": (-11.00, -76.90),
    "HUACHO": (-11.11, -77.61), "HUALLIN": (-11.60, -77.20), "LOMERA": (-11.50, -77.20),
    "CARHUAMAYO": (-10.92, -76.05), "PARAGSHA": (-10.68, -76.26), "YAUPI": (-10.90, -75.40),
    "CONDORCOCHA": (-11.40, -76.10), "MALPASO": (-11.40, -76.00), "CARIPA": (-11.40, -76.20),
    "OROYA": (-11.52, -75.90), "PACHACHACA": (-11.65, -75.95), "POMACOCHA": (-11.50, -76.00),
    "HUANCHOR": (-11.70, -76.40), "YANANGO": (-11.13, -75.37), "CHIMAY": (-11.20, -75.50),
    "LA VIRGEN": (-11.20, -75.40), "HUAYLLACHO": (-11.50, -75.90),
    "HUANZA": (-11.55, -76.50), "MATUCANA": (-11.85, -76.40), "CALLAHUANCA": (-11.84, -76.62),
    "HUINCO": (-11.78, -76.58), "MOYOPAMPA": (-11.94, -76.70), "HUAMPANI": (-11.93, -76.83),
    "CHAPARRAL": (-11.90, -76.70), "CARAPONGO": (-11.98, -76.87), "CAJAMARQUILLA": (-11.98, -76.90),
    "CARABAYLLO": (-11.86, -77.03), "ZAPALLAL": (-11.83, -77.09), "VENTANILLA": (-11.87, -77.13),
    "OQUENDO": (-11.95, -77.12), "CHAVARRIA": (-12.00, -77.10), "SANTA ROSA": (-12.03, -77.06),
    "SROSA": (-12.03, -77.06), "INDUSTRIALES": (-12.02, -77.00), "SAN MARTIN": (-12.05, -77.05),
    "SAN JUAN": (-12.15, -76.97), "PLANICIE": (-12.08, -76.85), "SANTA ISABEL": (-12.10, -76.95),
    "PIEDRA BLANCA": (-12.30, -76.90), "CANTERA": (-12.20, -76.90), "DESIERTO": (-12.40, -76.80),
    "CHILCA": (-12.52, -76.74), "LAS FLORES": (-12.50, -76.75), "KALLPA": (-12.51, -76.76),
    "FENIX": (-12.53, -76.73), "OLLEROS": (-12.54, -76.72), "TG5": (-12.51, -76.75),
    "PLATANAL": (-12.85, -75.90), "SAN ANTONIO": (-12.90, -76.00), "ASIA": (-12.78, -76.60),
    "HUAYUCACHI": (-12.13, -75.22), "CAMPO ARMIÑO": (-12.32, -74.63), "CAMPO ARMI": (-12.32, -74.63),
    "RESTITUCIÓN": (-12.25, -74.60), "RESTITUCI": (-12.25, -74.60),
    "CERRO DEL AGUILA": (-12.40, -74.60), "HUANCAVELICA": (-12.79, -74.98),
    # Sur y oriente
    "CHINCHA": (-13.42, -76.13), "JAHUAY": (-13.50, -75.90), "INDEPENDENCIA": (-13.70, -76.20),
    "CT PISCO": (-13.72, -76.20), "PISCO": (-13.72, -76.20), "FUNSUR": (-13.70, -76.22),
    "PARACAS": (-13.83, -76.25), "VILLACURI": (-13.90, -75.90), "CS COENERGY": (-13.80, -75.90),
    "ICA": (-14.07, -75.73), "PUNTA LOMITAS": (-14.60, -75.60), "FLAMENCO": (-14.90, -75.20),
    "NAZCA": (-14.83, -74.94), "POROMA": (-14.60, -75.00), "MARCONA": (-15.36, -75.16),
    "MINA": (-15.30, -75.10), "SAN NICOLAS": (-15.25, -75.23), "LOMAS": (-15.57, -74.85),
    "BELLA UNION": (-15.40, -74.60), "CHALA": (-15.86, -74.25),
    "COTARUSE": (-14.40, -73.20), "TUPURI": (-13.70, -73.00),
    "MOLLEPATA": (-13.50, -72.50), "SANTA TERESA": (-13.13, -72.60), "MACHUPICCHU": (-13.16, -72.55),
    "SANTA ANA": (-12.86, -72.69), "CACHIMAYO": (-13.45, -72.05), "DOLORESPATA": (-13.53, -71.97),
    "QUENCORO": (-13.55, -71.90), "CHIRIBAMBA": (-13.60, -72.30), "COMBAPATA": (-14.10, -71.43),
    "TINTAYA": (-14.92, -71.33), "CALLALLI": (-15.50, -71.44),
    "AYAVIRI": (-14.88, -70.59), "AZANGARO": (-14.91, -70.20), "JULIACA": (-15.50, -70.13),
    "PUNO": (-15.84, -70.02), "ALTO LA LUNA": (-15.60, -70.00), "SAN GABAN": (-13.43, -70.40),
    "MAZUCO": (-13.10, -70.37), "PUERTO MALDONADO": (-12.60, -69.19),
    "ALTO PRADERAS": (-16.70, -71.90), "REPARTICION": (-16.55, -71.90), "ERSUR": (-16.40, -71.60),
    "CERRO VERDE": (-16.53, -71.60), "CHARCANI": (-16.30, -71.50), "CHILINA": (-16.36, -71.53),
    "SANTUARIO": (-16.40, -71.50), "INTIPAMPA": (-16.45, -71.55), "SOCABAYA": (-16.45, -71.53),
    "MISAPUQUIO": (-16.40, -71.60), "GE1": (-16.42, -71.55), "MOLLENDO": (-17.02, -72.01),
    "MONTALVO": (-17.10, -70.90), "MOQUEGUA": (-17.19, -70.93), "PAQUILLUSI": (-17.20, -70.90),
    "BOTIFLACA": (-17.00, -70.80), "RUBI": (-17.30, -71.00), "TOQUEPALA": (-17.25, -70.65),
    "ARICOTA": (-17.40, -70.30), "ILO": (-17.64, -71.34), "PUERTO BRAVO": (-17.65, -71.35),
    "CT ILO2": (-17.70, -71.35), "S.E. ILO4": (-17.70, -71.35), "LOS HEROES": (-18.01, -70.25),
    "SAN JOSE": (-17.00, -71.60), "CPATO": (-11.95, -77.00), "CH OROYA": (-11.52, -75.90),
    "CHIRA": (-4.90, -80.90),
    # Sierra central minera (Yauli, Morococha, Casapalca) y otras
    "MANTARO": (-12.32, -74.63), "CASAPALCA": (-11.65, -76.23), "TICLIO": (-11.60, -76.18),
    "MOROCOCHA": (-11.60, -76.14), "YAULI": (-11.67, -76.09), "SAN MATEO": (-11.76, -76.30),
    "ROSAURA": (-11.65, -76.20), "BELLAVISTA": (-11.62, -76.12), "ANTUQUITO": (-11.62, -76.15),
    "AUSTRIA DUVAZ": (-11.60, -76.15), "MAHR TUNEL": (-11.67, -76.10), "SAN CRISTOBAL": (-11.72, -76.07),
    "ANDAYCHAGUA": (-11.75, -76.05), "CONCENTRADORA": (-11.68, -76.10), "AZULCOCHA": (-11.70, -76.08),
    "EXCELSIOR": (-11.55, -76.20), "EXPD": (-11.55, -76.20), "MILPO": (-10.75, -76.20),
    "MEPSA": (-11.53, -75.92), "SHELBY": (-10.70, -76.20), "PZINC": (-10.69, -76.25),
    "MAYUPAMPA": (-11.55, -76.18), "ALAMBRON": (-11.52, -75.92), "LA FUNDICION": (-11.52, -75.90),
    "ANTAGASHA": (-11.58, -76.05), "HUICRA": (-11.90, -76.55), "HUARON": (-11.00, -76.42),
    "SAM": (-11.60, -76.15), "CASA PIEDRA": (-11.60, -76.20), "HUAYUCACH": (-12.13, -75.22),
    "HUANCAVE": (-12.79, -74.98), "HUNCAVE": (-12.79, -74.98), "CARPAPATA": (-11.25, -75.55),
    "CONOCOCHA": (-10.12, -77.28), "KIMAN AYLLU": (-9.20, -77.75), "KIMANAYLLU": (-9.20, -77.75),
    "CARAZ": (-9.05, -77.81), "ARENAL": (-9.10, -78.45),
    # Lima y alrededores
    "HUACHIPA": (-12.00, -76.93), "SALAMANCA": (-12.08, -76.98), "BALNEARIOS": (-12.20, -77.00),
    "CHILLON": (-11.85, -77.05), "CAUDIVILLA": (-11.90, -77.05), "ANDAHUASI": (-11.15, -77.20),
    "AIPSA": (-11.10, -77.60), "NAÑA": (-11.99, -76.83), "ÑAÑA": (-11.99, -76.83),
    # Sur
    "ABANCAY": (-13.63, -72.88), "ANTAUTA": (-14.30, -70.30), "TOMASIRI": (-17.90, -70.50),
    "SARITA": (-17.60, -70.00), "ARCATA": (-15.05, -72.30), "ARES": (-15.10, -72.10),
    "CAYLLOMA": (-15.18, -71.77),
    # Norte y oriente
    "YARINA": (-8.40, -74.60), "PORCON": (-7.00, -78.60), "LA PAJUELA": (-7.00, -78.50),
}

# Posicion nominal para lo que no se reconoce: centro del pais.
NOMINAL = (-12.0, -75.0)


def _sin_tension(nombre: str) -> str:
    """'SOCABAYA 220' -> 'SOCABAYA'; 'ARICOTA1 66' -> 'ARICOTA'."""
    base = re.sub(r"\s+[\d.]+(?:_S)?$", "", nombre.strip())
    base = re.sub(r"\d+$", "", base).strip()
    return base.upper()


def ubicar(nombre: str) -> tuple[float, float, str]:
    base = _sin_tension(nombre)

    # La localidad mas larga contenida en el nombre gana: "CHILCA REP"
    # cae en CHILCA, "PUERTO MALDONADO" no cae en PUNO.
    candidatas = [loc for loc in LOCALIDADES if loc in base]

    if candidatas:
        elegida = max(candidatas, key=len)
        lat, lon = LOCALIDADES[elegida]
        return lat, lon, f"localidad:{elegida}"

    return NOMINAL[0], NOMINAL[1], "nominal"


def construir_coordenadas() -> pd.DataFrame:
    barras = pd.read_parquet(CURATED / "dim_barra.parquet")
    barras = barras.sort_values("barrcodi").reset_index(drop=True)

    ubicaciones = [ubicar(nombre) for nombre in barras["barrnombre"]]

    barras["lat"] = [u[0] for u in ubicaciones]
    barras["lon"] = [u[1] for u in ubicaciones]
    barras["metodo"] = [u[2] for u in ubicaciones]

    # Las barras de una misma localidad se separan un poco para que no se
    # pinten una encima de otra. Desplazamiento fijo por orden de codigo:
    # misma entrada, mismo mapa.
    orden = barras.groupby(["lat", "lon"]).cumcount()
    barras["lat"] = barras["lat"] + 0.035 * ((orden % 5) - 2)
    barras["lon"] = barras["lon"] + 0.035 * (((orden // 5) % 5) - 2)

    return barras[["barrcodi", "barrnombre", "barrtension", "lat", "lon", "metodo"]]


def main() -> None:
    tabla = construir_coordenadas()
    DESTINO.parent.mkdir(parents=True, exist_ok=True)
    tabla.to_csv(DESTINO, index=False, encoding="utf-8")

    reconocidas = int((tabla["metodo"] != "nominal").sum())

    print(
        f"{len(tabla)} barras -> {DESTINO.name}; "
        f"{reconocidas} con localidad, {len(tabla) - reconocidas} nominales"
    )


if __name__ == "__main__":
    main()

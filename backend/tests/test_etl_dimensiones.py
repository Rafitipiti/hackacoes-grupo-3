import pandas as pd
import pytest

from scripts.preparar_datos import (
    RAW,
    construir_dim_empresa,
    construir_dim_periodo,
    construir_dim_barra,
    construir_fact_evolucion,
)

pytestmark = pytest.mark.skipif(
    not RAW.exists(),
    reason=(
        "requiere el welcome kit en backend/data/raw/ "
        "(no versionado, ver README)"
    ),
)


@pytest.fixture(scope="module")
def con_liquidacion():
    evolucion = construir_fact_evolucion()

    return set(evolucion["empresa_deudora"].unique())


@pytest.fixture(scope="module")
def dim_empresa(con_liquidacion):
    return construir_dim_empresa(con_liquidacion)


def test_dim_empresa_tiene_una_fila_por_empresa(dim_empresa):
    assert len(dim_empresa) == 131
    assert list(dim_empresa.columns) == [
        "empresa_id",
        "alias",
        "ruc",
        "razon_social",
    ]


def test_los_alias_son_unicos(dim_empresa):
    assert dim_empresa["alias"].nunique() == len(dim_empresa)


def test_el_alias_es_estable_entre_ejecuciones(con_liquidacion):
    primera = construir_dim_empresa(con_liquidacion)
    segunda = construir_dim_empresa(con_liquidacion)
    pd.testing.assert_frame_equal(primera, segunda)


def test_solo_las_empresas_con_liquidacion_reciben_identidad(
    dim_empresa, con_liquidacion
):
    """Adjudicar identidad a un codigo sin datos crea una empresa fantasma.

    El selector no la ofrece (D4), pero el padron completo sigue saliendo
    por /empresas sin filtro: un nombre real ahi, sin ninguna cifra
    detras, es una atribucion sin respaldo.
    """
    identificadas = set(
        dim_empresa.loc[dim_empresa["ruc"].notna(), "empresa_id"]
    )

    assert identificadas == con_liquidacion


def test_ningun_ruc_se_asigna_a_dos_codigos(dim_empresa):
    rucs = dim_empresa["ruc"].dropna()

    assert rucs.nunique() == len(rucs)


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

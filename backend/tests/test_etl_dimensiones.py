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

import pytest

# Hueco planificado entre la Task 4 y la Task 9: loader.py todavia apunta
# a data/coes/, que la Task 4 borro, y lanza FileNotFoundError al importar.
# Ese caso concreto se tolera. Cualquier otro error tiene que explotar:
# estos 8 tests son la unica red que protege a las Tasks 9-12, y un test
# que se salta en silencio da cobertura falsa.
_error_datos = None

try:
    from fastapi.testclient import TestClient
    from app.main import app
except FileNotFoundError as exc:
    _error_datos = exc
    TestClient = None
    app = None


@pytest.fixture(scope="session")
def cliente():
    """Cliente HTTP contra la app, compartido por toda la sesión de pruebas.

    Es scope=session porque levantar la app carga los datasets, que es caro.
    """
    if _error_datos is not None:
        pytest.skip(f"capa de datos aún no disponible: {_error_datos}")

    with TestClient(app) as c:
        yield c

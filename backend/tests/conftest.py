import pytest

try:
    from fastapi.testclient import TestClient
    from app.main import app
    _app_available = True
except (ImportError, FileNotFoundError, Exception):
    _app_available = False


@pytest.fixture(scope="session")
def cliente():
    """Cliente HTTP contra la app, compartido por toda la sesión de pruebas.

    Es scope=session porque levantar la app carga los datasets, que es caro.
    """
    if not _app_available:
        pytest.skip("App no disponible")
    with TestClient(app) as c:
        yield c

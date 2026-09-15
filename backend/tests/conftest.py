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

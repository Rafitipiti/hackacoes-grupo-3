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

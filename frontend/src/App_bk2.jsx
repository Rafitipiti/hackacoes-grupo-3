import { useEffect, useState } from "react";
import axios from "axios";
import "./App.css";

const API_URL = "http://127.0.0.1:8000";

function App() {
  const [radar, setRadar] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fecha = "2026-08-01";

  useEffect(() => {
    cargarRadar();
  }, []);

  async function cargarRadar() {
    try {
      setLoading(true);

      const response = await axios.get(
        `${API_URL}/radar/${fecha}`
      );

      setRadar(response.data);
      setError(null);
    } catch (err) {
      console.error(err);
      setError(
        "No se pudo conectar con el backend de COES Liquidaciones 360."
      );
    } finally {
      setLoading(false);
    }
  }

  const agentesAnalizados = radar?.agentes_analizados || [];

  const alertas = radar?.alertas || [];

  const alertasRelevantes = alertas;

  const variacionPromedio =
    agentesAnalizados.length > 0
      ? agentesAnalizados.reduce(
        (total, item) => total + item.variacion_porcentual,
        0
      ) / agentesAnalizados.length
      : 0;

  return (
    <div className="app">

      <header className="header">
        <div>
          <h1>COES Liquidaciones 360</h1>
          <p>
            Consulta. Analiza. Explica. Decide.
          </p>
        </div>

        <div className="periodo">
          <span>Periodo analizado</span>
          <strong>Agosto 2026</strong>
        </div>
      </header>

      <main className="container">

        <section className="intro">
          <div>
            <h2>Panel de Liquidaciones</h2>
            <p>
              Visualiza variaciones relevantes y prioriza
              los casos que requieren análisis.
            </p>
          </div>

          <button onClick={cargarRadar}>
            Actualizar
          </button>
        </section>

        {loading && (
          <div className="message">
            Cargando información...
          </div>
        )}

        {error && (
          <div className="message error">
            {error}
          </div>
        )}

        {!loading && !error && radar && (
          <>
            <section className="cards">

              <div className="card">
                <span>Total agentes</span>
                <strong>{agentesAnalizados.length}</strong>
                <small>
                  Agentes analizados
                </small>
              </div>

              <div className="card">
                <span>Alertas relevantes</span>
                <strong>
                  {alertasRelevantes.length}
                </strong>
                <small>
                  Score ≥ 60
                </small>
              </div>

              <div className="card">
                <span>Variación promedio</span>
                <strong>
                  {variacionPromedio.toFixed(1)}%
                </strong>
                <small>
                  Frente al periodo anterior
                </small>
              </div>

              <div className="card highlight">
                <span>Estado del radar</span>
                <strong>
                  {alertasRelevantes.length > 0
                    ? "REVISAR"
                    : "NORMAL"}
                </strong>
                <small>
                  Priorización automática
                </small>
              </div>

            </section>

            <section className="panel">

              <div className="panel-header">
                <div>
                  <h2>Radar de Liquidaciones</h2>
                  <p>
                    Casos ordenados según su nivel de relevancia.
                  </p>
                </div>

                <div className="badge">
                  {radar.total_agentes} agentes
                </div>
              </div>

              <div className="table-container">

                <table>

                  <thead>
                    <tr>
                      <th>Agente</th>
                      <th>Variación</th>
                      <th>Impacto</th>
                      <th>Score</th>
                      <th>Nivel</th>
                    </tr>
                  </thead>

                  <tbody>

                    {agentesAnalizados.map((item) => (

                      <tr key={item.agente_id}>

                        <td>
                          <strong>
                            {item.agente_id}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={
                              item.variacion_porcentual >= 0
                                ? "positive"
                                : "negative"
                            }
                          >
                            {item.variacion_porcentual >= 0
                              ? "+"
                              : ""}
                            {item.variacion_porcentual.toFixed(2)}
                            %
                          </span>
                        </td>

                        <td>
                          S/{" "}
                          {item.variacion_absoluta.toLocaleString(
                            "es-PE",
                            {
                              minimumFractionDigits: 2,
                            }
                          )}
                        </td>

                        <td>
                          <strong>
                            {item.score}
                          </strong>
                        </td>

                        <td>
                          <span
                            className={`level ${item.nivel.toLowerCase()}`}
                          >
                            {item.nivel}
                          </span>
                        </td>

                      </tr>

                    ))}

                  </tbody>

                </table>

              </div>

            </section>

            <section className="insight">

              <div className="insight-icon">
                !
              </div>

              <div>
                <h3>
                  ¿Qué está pasando?
                </h3>

                <p>
                  El Radar identifica automáticamente
                  variaciones relevantes entre periodos.
                  El siguiente nivel del sistema permitirá
                  profundizar desde la variación total hasta
                  los conceptos y variables que explican el cambio.
                </p>
              </div>

            </section>

          </>
        )}

      </main>

      <footer>
        COES Liquidaciones 360 · MVP HackCOES 2026
      </footer>

    </div>
  );
}

export default App;
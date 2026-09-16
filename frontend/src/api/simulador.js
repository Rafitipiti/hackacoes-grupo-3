import { cliente } from "./cliente.js";

export async function obtenerBaseSimulador(empresaId, pericodi) {
  const { data } = await cliente.get(`/simulador/base/${empresaId}/${pericodi}`);
  return data;
}

export async function obtenerBarrasSimulador(pericodi) {
  const { data } = await cliente.get(`/simulador/barras/${pericodi}`);
  return data;
}

/**
 * Valoriza filas {barra, dia, entregas, retiros} con el costo marginal
 * publicado. `barra` puede ser nombre, código o null (usa barraDefecto).
 */
export async function valorizarEnergia({ pericodi, granularidad, barraDefecto, filas }) {
  const { data } = await cliente.post("/simulador/valorizar", {
    pericodi,
    granularidad,
    barra_defecto: barraDefecto ?? null,
    filas,
  });
  return data;
}

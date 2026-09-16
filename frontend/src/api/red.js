import { cliente } from "./cliente.js";

// Con empresaId la energia de cada barra es solo la de esa empresa; el
// costo marginal es del sistema y no cambia.
export async function obtenerBarras(pericodi, empresaId) {
  const { data } = await cliente.get(`/red/barras/${pericodi}`, {
    params: empresaId ? { empresa_id: empresaId } : {},
  });
  return data;
}

export async function obtenerCmgDiario(barrcodi, pericodi) {
  const { data } = await cliente.get(`/red/cmg/${barrcodi}/${pericodi}`);
  return data;
}

export async function obtenerEnergiaDiaria(barrcodi, pericodi, empresaId) {
  const { data } = await cliente.get(`/red/energia/${barrcodi}/${pericodi}`, {
    params: empresaId ? { empresa_id: empresaId } : {},
  });
  return data;
}

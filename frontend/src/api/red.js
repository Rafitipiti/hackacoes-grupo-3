import { cliente } from "./cliente.js";

export async function obtenerBarras(pericodi) {
  const { data } = await cliente.get(`/red/barras/${pericodi}`);
  return data;
}

export async function obtenerCmgDiario(barrcodi, pericodi) {
  const { data } = await cliente.get(`/red/cmg/${barrcodi}/${pericodi}`);
  return data;
}

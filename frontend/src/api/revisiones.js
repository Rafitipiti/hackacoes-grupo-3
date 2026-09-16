import { cliente } from "./cliente.js";

export async function obtenerCascada(empresaId, pericodi) {
  const { data } = await cliente.get(`/revisiones/cascada/${empresaId}/${pericodi}`);
  return data;
}

export async function obtenerCalendario(pericodi) {
  const { data } = await cliente.get(`/revisiones/calendario/${pericodi}`);
  return data;
}

export async function obtenerImpacto(pericodi) {
  const { data } = await cliente.get(`/revisiones/impacto/${pericodi}`);
  return data;
}

import { cliente } from "./cliente.js";

// Endpoints del analisis por empresa y del radar del sector. Son los que
// ya consumia el flujo legado; aqui solo se envuelven para las vistas
// ejecutivas de Panorama y Mi empresa.

export async function obtenerRadar(pericodi) {
  const { data } = await cliente.get(`/radar/${pericodi}`);
  return data;
}

export async function obtenerResumenAgente(empresaId, pericodi) {
  const { data } = await cliente.get(`/agente/resumen/${empresaId}/${pericodi}`);
  return data;
}

export async function obtenerTrazabilidad(empresaId, pericodi) {
  const { data } = await cliente.get(`/agente/trazabilidad/${empresaId}/${pericodi}`);
  return data;
}

export async function obtenerContexto(empresaId, pericodi) {
  const { data } = await cliente.get(`/agente/contexto/${empresaId}/${pericodi}`);
  return data;
}

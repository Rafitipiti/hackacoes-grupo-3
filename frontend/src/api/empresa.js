import { cliente } from "./cliente.js";

export async function obtenerHistorico(empresaId) {
  const { data } = await cliente.get(`/empresa/historico/${empresaId}`);
  return data;
}

export async function obtenerComparativa(pericodi) {
  const { data } = await cliente.get(`/empresas/comparar/${pericodi}`);
  return data;
}

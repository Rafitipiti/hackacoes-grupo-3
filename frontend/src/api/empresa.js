import { cliente } from "./cliente.js";

export async function obtenerHistorico(empresaId) {
  const { data } = await cliente.get(`/empresa/historico/${empresaId}`);
  return data;
}

export async function obtenerComparativa(pericodi) {
  const { data } = await cliente.get(`/empresas/comparar/${pericodi}`);
  return data;
}

export async function obtenerPagosCobros(empresaId, pericodi) {
  const { data } = await cliente.get(`/empresa/pagos-cobros/${empresaId}/${pericodi}`);
  return data;
}

// El padron completo (131 codigos, con alias para los que no tienen
// identidad real): sirve para nombrar contrapartes que no liquidan.
export async function obtenerPadron() {
  const { data } = await cliente.get("/empresas");
  return data.empresas ?? [];
}

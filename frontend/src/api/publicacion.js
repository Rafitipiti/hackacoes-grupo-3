import { cliente } from "./cliente.js";

export async function obtenerPublicacion(pericodi, empresaId) {
  const { data } = await cliente.get(`/publicacion/${pericodi}`, {
    params: empresaId ? { empresa_id: empresaId } : {},
  });
  return data;
}

export async function obtenerDetallePublicacion(pericodi, proceso, liquidado, revision, empresaId) {
  const { data } = await cliente.get(
    `/publicacion/${pericodi}/detalle/${proceso}/${liquidado}/${revision}`,
    { params: empresaId ? { empresa_id: empresaId } : {} },
  );
  return data;
}

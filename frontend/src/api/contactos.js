import { cliente } from "./cliente.js";

export async function listarContactos() {
  const { data } = await cliente.get("/contactos");
  return data;
}

export async function guardarContacto(empresaId, ficha) {
  const { data } = await cliente.put(`/contactos/${empresaId}`, ficha);
  return data;
}

export async function eliminarContacto(empresaId) {
  const { data } = await cliente.delete(`/contactos/${empresaId}`);
  return data;
}

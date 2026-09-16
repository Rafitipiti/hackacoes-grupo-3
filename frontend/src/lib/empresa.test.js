import { describe, expect, it } from "vitest";

import {
  etiquetaEmpresa,
  nombreEmpresa,
  ordenarEmpresas,
} from "./empresa.js";

const CON_IDENTIDAD = {
  empresa_id: "EMPRESA_001",
  alias: "Transmisora Titicaca",
  ruc: "20100027705",
  razon_social: "EMPRESA ELECTRICIDAD DEL PERÚ S.A.",
};

const SIN_IDENTIDAD = {
  empresa_id: "EMPRESA_072",
  alias: "Distribuidora Central",
  ruc: null,
  razon_social: null,
};

describe("nombreEmpresa", () => {
  it("prefiere la razon social", () => {
    expect(nombreEmpresa(CON_IDENTIDAD)).toBe(
      "EMPRESA ELECTRICIDAD DEL PERÚ S.A.",
    );
  });

  it("cae al alias cuando no hay identidad real", () => {
    expect(nombreEmpresa(SIN_IDENTIDAD)).toBe("Distribuidora Central");
  });

  it("nunca deja una fila sin nombre", () => {
    expect(nombreEmpresa({ empresa_id: "EMPRESA_999" })).toBe("EMPRESA_999");
    expect(nombreEmpresa(null)).toBe("");
  });
});

describe("etiquetaEmpresa", () => {
  it("agrega el RUC, que es lo que desempata nombres parecidos", () => {
    expect(etiquetaEmpresa(CON_IDENTIDAD)).toBe(
      "EMPRESA ELECTRICIDAD DEL PERÚ S.A. · RUC 20100027705",
    );
  });

  it("no inventa un RUC cuando no lo hay", () => {
    expect(etiquetaEmpresa(SIN_IDENTIDAD)).toBe("Distribuidora Central");
  });
});

describe("ordenarEmpresas", () => {
  it("ordena por el texto visible, no por la clave tecnica", () => {
    const ordenadas = ordenarEmpresas([CON_IDENTIDAD, SIN_IDENTIDAD]);

    expect(ordenadas.map((e) => e.empresa_id)).toEqual([
      "EMPRESA_072",
      "EMPRESA_001",
    ]);
  });

  it("no toca el arreglo recibido", () => {
    const lista = [CON_IDENTIDAD, SIN_IDENTIDAD];
    ordenarEmpresas(lista);

    expect(lista[0]).toBe(CON_IDENTIDAD);
  });
});

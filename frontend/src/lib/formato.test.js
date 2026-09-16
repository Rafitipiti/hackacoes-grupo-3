import { describe, expect, it } from "vitest";

import { numero, porcentaje, soles } from "./formato.js";

describe("soles", () => {
  it("usa separador de miles y simbolo peruano", () => {
    expect(soles(1282616.13)).toBe("S/ 1,282,616.13");
  });

  it("conserva el signo negativo", () => {
    expect(soles(-4515658.58)).toBe("-S/ 4,515,658.58");
  });

  it("devuelve un guion cuando no hay dato", () => {
    expect(soles(null)).toBe("—");
    expect(soles(undefined)).toBe("—");
  });
});

describe("porcentaje", () => {
  it("convierte una fraccion a porcentaje con signo", () => {
    expect(porcentaje(-0.027)).toBe("-2.7%");
    expect(porcentaje(0.1234)).toBe("+12.3%");
  });

  it("devuelve un guion cuando no hay dato", () => {
    expect(porcentaje(null)).toBe("—");
  });
});

describe("numero", () => {
  it("formatea con separador de miles", () => {
    expect(numero(109.26081)).toBe("109.26");
  });
});

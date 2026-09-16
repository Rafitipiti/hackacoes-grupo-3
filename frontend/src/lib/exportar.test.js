import { describe, expect, it } from "vitest";

import { aCSV } from "./exportar.js";

describe("aCSV", () => {
  it("usa las claves de la primera fila como cabecera", () => {
    const csv = aCSV([{ proceso: "LVTA", monto: 100 }]);

    expect(csv.split("\n")[0]).toBe("proceso,monto");
  });

  it("escapa comas y comillas para que no rompan la columna", () => {
    const csv = aCSV([{ nombre: 'Generadora "Andina", S.A.' }]);

    expect(csv.split("\n")[1]).toBe('"Generadora ""Andina"", S.A."');
  });

  it("convierte null y undefined en celda vacia", () => {
    const csv = aCSV([{ a: null, b: undefined, c: 0 }]);

    expect(csv.split("\n")[1]).toBe(",,0");
  });

  it("devuelve cadena vacia si no hay filas", () => {
    expect(aCSV([])).toBe("");
  });
});

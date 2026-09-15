import { describe, expect, it } from "vitest";

import { clasificarVariacion } from "./variaciones.js";

describe("clasificarVariacion", () => {
  it("el caso normal trae porcentaje", () => {
    const v = clasificarVariacion(112.3, 100);

    expect(v.tipo).toBe("normal");
    expect(v.texto).toBe("+12.3%");
  });

  it("un cambio de signo NO se muestra como porcentaje", () => {
    // De cobrar 205.000 a pagar 60.000 no es "-129%": es un cambio de
    // posicion, y el porcentaje solo confunde.
    const v = clasificarVariacion(-60000, 205000);

    expect(v.tipo).toBe("cambio-signo");
    expect(v.texto).toContain("↔");
    expect(v.texto).not.toContain("%");
  });

  it("una variacion mayor a 999% muestra el delta, no el porcentaje", () => {
    const v = clasificarVariacion(50000, 10);

    expect(v.tipo).toBe("fuera-de-rango");
    expect(v.texto).toContain("Δ");
    expect(v.texto).not.toContain("%");
  });

  it("sin periodo base devuelve sin dato", () => {
    expect(clasificarVariacion(100, null).tipo).toBe("sin-dato");
    expect(clasificarVariacion(100, 0).tipo).toBe("sin-dato");
    expect(clasificarVariacion(100, null).texto).toBe("s/d");
  });

  it("clasifica la magnitud para disparar la atencion", () => {
    expect(clasificarVariacion(110, 100).magnitud).toBe("normal");
    expect(clasificarVariacion(130, 100).magnitud).toBe("revisar");
    expect(clasificarVariacion(160, 100).magnitud).toBe("fuerte");
  });

  it("la magnitud no depende del signo: bajar 60% tambien es fuerte", () => {
    expect(clasificarVariacion(40, 100).magnitud).toBe("fuerte");
  });
});

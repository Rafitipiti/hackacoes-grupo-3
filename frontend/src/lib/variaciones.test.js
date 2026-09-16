import { describe, expect, it } from "vitest";

import { clasificarVariacion, describirVariacion } from "./variaciones.js";

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

  it("el signo del delta va antes del simbolo de moneda", () => {
    // Es el formato que usa soles() en todo el modulo: -S/ 50 k, no S/ -50 k.
    const v = clasificarVariacion(-50000, -10);

    expect(v.tipo).toBe("fuera-de-rango");
    expect(v.texto).toContain("-S/");
    expect(v.texto).not.toContain("S/ -");
  });

  it("el limite de 999% deja el borde del lado del porcentaje", () => {
    // Justo en el limite todavia informa; un paso mas alla, no.
    expect(clasificarVariacion(1099, 100).tipo).toBe("normal");
    expect(clasificarVariacion(1099.01, 100).tipo).toBe("fuera-de-rango");
  });

  it("dos periodos negativos comparan como cualquier otro par", () => {
    // Una cuenta que paga menos que antes. El sistema reporta la direccion
    // numerica y no opina sobre si eso es bueno: eso depende de si la
    // empresa cobra o paga, y solo el usuario lo sabe.
    const v = clasificarVariacion(-50, -100);

    expect(v.tipo).toBe("normal");
    expect(v.texto).toBe("+50.0%");
  });
});

describe("describirVariacion", () => {
  it("con cambioSigno=true no calcula nada, confia en quien llama", () => {
    // Quien llama (clasificarVariacion, que tiene actual y anterior con
    // signo real) ya decidio que hubo cruce de cero; describirVariacion
    // solo arma texto y magnitud a partir de delta y pct.
    const v = describirVariacion({ delta: -265000, pct: -1.293, cambioSigno: true });

    expect(v.tipo).toBe("cambio-signo");
    expect(v.texto).toContain("↔");
    expect(v.texto).not.toContain("%");
  });

  it("fuera de rango: una variacion mayor a 999% muestra el delta", () => {
    const v = describirVariacion({ delta: 49990, pct: 4999 });

    expect(v.tipo).toBe("fuera-de-rango");
    expect(v.texto).toContain("Δ");
    expect(v.texto).not.toContain("%");
  });

  it("caso normal: sin cambioSigno y dentro de rango, da porcentaje", () => {
    const v = describirVariacion({ delta: 12.3, pct: 0.123 });

    expect(v.tipo).toBe("normal");
    expect(v.texto).toBe("+12.3%");
  });

  it("sin delta o pct devuelve sin-dato", () => {
    expect(describirVariacion({ delta: null, pct: null }).tipo).toBe("sin-dato");
    expect(describirVariacion({ delta: 10, pct: undefined }).tipo).toBe("sin-dato");
  });

  it("sin cambioSigno, un pct fuera de [-1,1] por un vaiven grande (no un cruce de cero) se reporta como variacion grande, no como cambio de posicion", () => {
    // delta y pct por si solos no distinguen "cruzo cero" de "crecio mucho
    // sin cruzarlo" (ver el comentario en variaciones.js). Sin la señal
    // cambioSigno, describirVariacion nunca inventa un cruce que no puede
    // confirmar: se queda en normal o fuera-de-rango segun la magnitud.
    const v = describirVariacion({ delta: 250, pct: 2.5 });

    expect(v.tipo).toBe("normal");
    expect(v.texto).toBe("+250.0%");
  });
});

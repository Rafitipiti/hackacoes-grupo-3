import { describe, expect, it } from "vitest";

import {
  calcularProcesos,
  defectosDesde,
  ejemploEnergia,
  formulaLVTEA,
  leerNumero,
  parsearEnergia,
} from "./simulador.js";

describe("leerNumero", () => {
  it("entiende los dos formatos de miles y decimales", () => {
    expect(leerNumero("1.234,56")).toBe(1234.56);
    expect(leerNumero("1,234.56")).toBe(1234.56);
    expect(leerNumero("1234.5")).toBe(1234.5);
    expect(leerNumero(" 12 ")).toBe(12);
    expect(leerNumero("abc")).toBeNull();
    expect(leerNumero("")).toBeNull();
  });
});

describe("parsearEnergia", () => {
  it("lee entregas y retiros mensuales de una barra, con cabecera o sin ella", () => {
    const sin = parsearEnergia("3620\t10480", { granularidad: "mes", alcance: "total" });
    expect(sin.filas).toEqual([{ barra: null, dia: null, entregas: 3620, retiros: 10480 }]);
    expect(sin.ignoradas).toEqual([]);

    const con = parsearEnergia("Entregas\tRetiros\n3620\t10480", { granularidad: "mes", alcance: "total" });
    expect(con.filas).toHaveLength(1);
  });

  it("acepta la barra delante y separadores distintos", () => {
    const r = parsearEnergia("TALARA 220;3620;10480\nCHILCA 500, 63000, 2400", { granularidad: "mes", alcance: "barras" });
    expect(r.filas.map((f) => f.barra)).toEqual(["TALARA 220", "CHILCA 500"]);
    expect(r.filas[1]).toMatchObject({ entregas: 63000, retiros: 2400 });
  });

  it("en granularidad diaria valida el día", () => {
    const r = parsearEnergia("1\t10\t5\n31\t10\t5\nx\t1\t2", { granularidad: "dia", alcance: "total", diasDelMes: 30 });
    expect(r.filas).toEqual([{ barra: null, dia: 1, entregas: 10, retiros: 5 }]);
    expect(r.ignoradas.map((i) => i.motivo)).toEqual(["día fuera de 1–30", "faltan columnas numéricas (se esperan 3)"]);
  });

  it("pide la barra cuando el alcance es varias barras", () => {
    const r = parsearEnergia("10\t5", { granularidad: "mes", alcance: "barras" });
    expect(r.filas).toEqual([]);
    expect(r.ignoradas[0].motivo).toMatch(/nombre de la barra/);
  });

  it("los ejemplos se leen enteros", () => {
    for (const g of ["mes", "dia"]) {
      for (const a of ["total", "barras"]) {
        const r = parsearEnergia(ejemploEnergia(g, a), { granularidad: g, alcance: a, diasDelMes: 31 });
        expect(r.ignoradas).toEqual([]);
        expect(r.filas.length).toBeGreaterThan(0);
      }
    }
  });
});

const BASE = {
  cmg_sistema: 0.14,
  energia: { entregas: 1000, retiros: 400 },
  liquidado: { LVTA: { monto: 50000 }, LVTP: { monto: -31000 }, LSCIO: null, "SST-SCT": { monto: -700 } },
  mecanismos: { LVTA: {}, LVTP: {}, LSCIO: { reactiva: -10, rsf: -20, inflexibilidad: -30 }, "SST-SCT": { criterio_uso: -650, ingreso_tarifario: -50 } },
  cuota: { LVTA: { mediana: 0.1 }, LVTP: { mediana: -0.2 }, LSCIO: null, "SST-SCT": { mediana: -0.05 } },
  sistema: { LVTA: 1_000_000, LVTP: 500_000, LSCIO: 10_000, "SST-SCT": 20_000 },
};

describe("formulas", () => {
  it("LVTEA cobra cuando entrega más de lo que retira", () => {
    expect(formulaLVTEA({ entregas: 1000, retiros: 400, cmg: 0.14 }).monto).toBeCloseTo(600 * 0.14 * 1000);
    expect(formulaLVTEA({ entregas: 0, retiros: 10, cmg: 0.1 }).monto).toBeLessThan(0);
  });

  it("los valores de arranque salen de lo liquidado y sus mecanismos", () => {
    const d = defectosDesde(BASE);
    expect(d.entregas).toBe(1000);
    expect(d.dc).toBeCloseTo(31000 / (31 * 1000));
    expect(d.signoLVTP).toBe(-1);
    expect(d.lscio).toEqual({ reactiva: -10, rsf: -20, inflexibilidad: -30 });
    expect(d.sst.criterio_uso).toBe(-650);
  });

  it("por cuota aplica la participación al volumen del mes; por fórmula, los valores", () => {
    const cuota = calcularProcesos({ base: BASE, via: "cuota" }).procesos;
    expect(cuota.LVTA.porCuota).toBeCloseTo(100_000);
    expect(cuota.LVTA.usado).toBeCloseTo(100_000);
    expect(cuota.LSCIO.porCuota).toBeNull();

    const formula = calcularProcesos({ base: BASE, via: "formula" }).procesos;
    expect(formula.LVTA.usado).toBeCloseTo(600 * 0.14 * 1000);
    expect(formula.LVTP.usado).toBeCloseTo(-31000);
    expect(formula.LSCIO.usado).toBeCloseTo(-60);
    expect(formula["SST-SCT"].usado).toBeCloseTo(-700);
    expect(formula["SST-SCT"].diferencia).toBeCloseTo(0);
  });

  it("el escenario mueve retiros, costo marginal y demanda", () => {
    const r = calcularProcesos({ base: BASE, via: "formula", escenario: 10 });
    expect(r.valores.retiros).toBeCloseTo(440);
    expect(r.valores.cmg).toBeCloseTo(0.154);
    expect(r.procesos.LVTP.usado).toBeCloseTo(-31000 * 1.1);
  });

  it("la energía valorizada manda sobre la cuota y un monto fijo manda sobre todo", () => {
    const r = calcularProcesos({
      base: BASE,
      via: "cuota",
      energiaValorizada: { filas: 3, total: 12345, energia_neta: 90 },
      entradas: { fijo: { LVTP: 999 } },
    }).procesos;
    expect(r.LVTA.usado).toBeCloseTo(12345);
    expect(r.LVTA.detalle.delDetalle).toBe(true);
    expect(r.LVTP.usado).toBe(999);
    expect(r.LVTP.fijo).toBe(999);
  });
});

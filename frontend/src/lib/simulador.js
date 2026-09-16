// Simulador (spec, seccion 12): leer lo que el usuario pega y aplicar las
// formulas de los cuatro procesos a sus numeros.
//
// La valorizacion de la energia con el costo marginal la hace el servidor,
// que tiene el CMg de cada barra y cada dia. Aqui vive lo que no necesita
// datos: entender una hoja pegada desde Excel y las formulas que combinan
// los valores escritos con los que la empresa tuvo de verdad.
//
// Signo: como en todo el portal, positivo es lo que la empresa COBRA y
// negativo lo que PAGA.

export const PROCESOS_SIMULADOR = ["LVTA", "LVTP", "LSCIO", "SST-SCT"];

/** Interpreta un numero escrito como 1.234,56 o 1,234.56 o 1234.56. */
export function leerNumero(texto) {
  const s = String(texto ?? "").replace(/\s/g, "");
  if (!s) return null;
  const decimalComa = s.includes(",") && s.lastIndexOf(",") > s.lastIndexOf(".");
  const limpio = decimalComa ? s.replace(/\./g, "").replace(",", ".") : s.replace(/,/g, "");
  const n = Number.parseFloat(limpio);
  return Number.isFinite(n) ? n : null;
}

function partirLinea(linea) {
  // Tabulador, punto y coma, coma que no va pegada a un digito (asi 1,234.56
  // sigue siendo un numero), o dos espacios o mas.
  return linea
    .split(/\t|;|,(?!\d)|\s{2,}/)
    .map((x) => x.trim())
    .filter((x) => x !== "");
}

/**
 * Lee lo que se pega desde una hoja de calculo. Acepta con o sin cabecera,
 * separado por tabulador, coma o punto y coma. Devuelve las filas que
 * entendio y las lineas que ignoro, con el motivo.
 *
 * Formas admitidas segun granularidad y alcance:
 *   mensual · una barra   → entregas · retiros
 *   mensual · varias      → barra · entregas · retiros
 *   diaria  · una barra   → día · entregas · retiros
 *   diaria  · varias      → barra · día · entregas · retiros
 */
export function parsearEnergia(texto, { granularidad = "mes", alcance = "total", diasDelMes = 31 } = {}) {
  const lineas = String(texto ?? "").split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (!lineas.length) return { filas: [], ignoradas: [] };

  const primera = partirLinea(lineas[0]);
  const esCabecera =
    primera.some((x) => /barra|d[ií]a|entrega|retiro|mwh/i.test(x)) &&
    primera.filter((x) => leerNumero(x) !== null).length < 2;
  const cuerpo = esCabecera ? lineas.slice(1) : lineas;
  const desplazamiento = esCabecera ? 2 : 1;

  const filas = [];
  const ignoradas = [];
  const porDia = granularidad === "dia";
  const conBarra = alcance === "barras";

  cuerpo.forEach((linea, i) => {
    const numeroLinea = i + desplazamiento;
    const celdas = partirLinea(linea);
    const numeros = celdas.map(leerNumero);
    const textos = celdas.filter((_, k) => numeros[k] === null);
    const soloNumeros = numeros.filter((n) => n !== null);

    let barra = null;
    if (conBarra) {
      if (!textos.length) {
        ignoradas.push({ linea: numeroLinea, texto: linea, motivo: "falta el nombre de la barra" });
        return;
      }
      barra = textos[0];
    }

    const necesarios = porDia ? 3 : 2;
    if (soloNumeros.length < necesarios) {
      ignoradas.push({ linea: numeroLinea, texto: linea, motivo: `faltan columnas numéricas (se esperan ${necesarios})` });
      return;
    }

    let dia = null;
    let entregas;
    let retiros;
    if (porDia) {
      [dia, entregas, retiros] = soloNumeros;
      if (!Number.isInteger(dia) || dia < 1 || dia > diasDelMes) {
        ignoradas.push({ linea: numeroLinea, texto: linea, motivo: `día fuera de 1–${diasDelMes}` });
        return;
      }
    } else {
      [entregas, retiros] = soloNumeros;
    }

    filas.push({ barra, dia, entregas: entregas || 0, retiros: retiros || 0 });
  });

  return { filas, ignoradas };
}

export function ejemploEnergia(granularidad, alcance) {
  if (granularidad === "dia") {
    return alcance === "barras"
      ? "TALARA 220\t1\t120.5\t340.2\nTALARA 220\t2\t118.0\t351.7\nCHILCA 500\t1\t2100\t80"
      : "1\t120.5\t340.2\n2\t118.0\t351.7\n3\t131.4\t329.9";
  }
  return alcance === "barras"
    ? "TALARA 220\t3620\t10480\nCHILCA 500\t63000\t2400\nAGROLMOS 60\t180\t2950"
    : "3620\t10480";
}

// ------------------------------------------------------------ las formulas

// Precios de referencia para despejar la demanda coincidente cuando la
// empresa no la escribe: S/ por kW-mes, orden de magnitud del mercado.
export const PRECIO_POTENCIA_REFERENCIA = 25.0;
export const PEAJE_REFERENCIA = 6.0;

const numeroO = (valor, defecto) => (valor === null || valor === undefined || valor === "" ? defecto : Number(valor));
const signoDe = (monto, defecto = -1) => (monto === null || monto === undefined || monto === 0 ? defecto : Math.sign(monto));

/**
 * Valores de arranque a partir de lo que la empresa tuvo de verdad en el
 * mes: energia por barra, montos liquidados y sus mecanismos.
 */
export function defectosDesde(base) {
  const liquidado = (p) => base?.liquidado?.[p]?.monto ?? null;
  const mecanismos = (p) => base?.mecanismos?.[p] ?? {};

  const lvtp = liquidado("LVTP");
  const precioPot = PRECIO_POTENCIA_REFERENCIA;
  const peaje = PEAJE_REFERENCIA;
  // La potencia no viene en MW: se despeja del monto de potencia con un
  // precio de referencia. Es un valor derivado y el panel lo dice.
  const dc = lvtp === null ? 0 : Math.abs(lvtp) / ((precioPot + peaje) * 1000);

  return {
    entregas: base?.energia?.entregas ?? 0,
    retiros: base?.energia?.retiros ?? 0,
    cmg: base?.cmg_sistema ?? 0,
    dc,
    precioPot,
    peaje,
    signoLVTP: signoDe(lvtp),
    lscio: {
      reactiva: mecanismos("LSCIO").reactiva ?? 0,
      rsf: mecanismos("LSCIO").rsf ?? 0,
      inflexibilidad: mecanismos("LSCIO").inflexibilidad ?? 0,
    },
    sst: {
      criterio_uso: mecanismos("SST-SCT").criterio_uso ?? 0,
      ingreso_tarifario: mecanismos("SST-SCT").ingreso_tarifario ?? 0,
    },
  };
}

/** LVTEA = Σ CMg × (Entregas − Retiros). CMg en S/ por kWh, energia en MWh. */
export function formulaLVTEA({ entregas, retiros, cmg }) {
  const neto = entregas - retiros;
  return { monto: neto * cmg * 1000, neto };
}

/** LVTP = Demanda coincidente × (Precio de potencia + Peaje) × 1000, con el signo de la empresa. */
export function formulaLVTP({ dc, precioPot, peaje, signo = -1 }) {
  return { monto: signo * dc * (precioPot + peaje) * 1000 };
}

/** LSCIO = Reactiva + RSF + Inflexibilidad operativa. */
export function formulaLSCIO({ reactiva, rsf, inflexibilidad }) {
  const monto = (Number(reactiva) || 0) + (Number(rsf) || 0) + (Number(inflexibilidad) || 0);
  return { monto, vacio: monto === 0 };
}

/** SST-SCT = Criterio de uso + Ingreso tarifario. */
export function formulaSST({ criterio_uso, ingreso_tarifario }) {
  return { monto: (Number(criterio_uso) || 0) + (Number(ingreso_tarifario) || 0) };
}

/**
 * Los cuatro procesos por las dos vias.
 *
 * `entradas` lleva lo que el usuario escribio (null = usar el valor de
 * arranque); `energiaValorizada` es la respuesta del servidor cuando pego su
 * energia; `via` es "cuota" | "formula"; `escenario` es un ±% que mueve
 * retiros, costo marginal y demanda (los drivers, no el resultado).
 */
export function calcularProcesos({ base, entradas = {}, via = "cuota", escenario = 0, energiaValorizada = null }) {
  const d = defectosDesde(base);
  const f = 1 + (Number(escenario) || 0) / 100;

  const v = {
    entregas: numeroO(entradas.entregas, d.entregas),
    retiros: numeroO(entradas.retiros, d.retiros) * f,
    cmg: numeroO(entradas.cmg, d.cmg) * f,
    dc: numeroO(entradas.dc, d.dc) * f,
    precioPot: numeroO(entradas.precioPot, d.precioPot),
    peaje: numeroO(entradas.peaje, d.peaje),
    lscio: {
      reactiva: numeroO(entradas.lscio?.reactiva, d.lscio.reactiva),
      rsf: numeroO(entradas.lscio?.rsf, d.lscio.rsf),
      inflexibilidad: numeroO(entradas.lscio?.inflexibilidad, d.lscio.inflexibilidad),
    },
    sst: {
      criterio_uso: numeroO(entradas.sst?.criterio_uso, d.sst.criterio_uso),
      ingreso_tarifario: numeroO(entradas.sst?.ingreso_tarifario, d.sst.ingreso_tarifario),
    },
  };

  const salida = {};
  for (const p of PROCESOS_SIMULADOR) {
    const liquidado = base?.liquidado?.[p]?.monto ?? null;
    let porFormula = null;
    let detalle = null;

    if (p === "LVTA") {
      if (energiaValorizada && energiaValorizada.filas > 0) {
        porFormula = energiaValorizada.total * f;
        detalle = { delDetalle: true, filas: energiaValorizada.filas, neto: energiaValorizada.energia_neta };
      } else {
        const r = formulaLVTEA(v);
        porFormula = r.monto;
        detalle = { delDetalle: false, neto: r.neto };
      }
    } else if (p === "LVTP") {
      porFormula = formulaLVTP({ ...v, signo: d.signoLVTP }).monto;
    } else if (p === "LSCIO") {
      const r = formulaLSCIO(v.lscio);
      porFormula = r.monto;
      detalle = { vacio: r.vacio };
    } else {
      porFormula = formulaSST(v.sst).monto;
    }

    const cuota = base?.cuota?.[p] ?? null;
    const volumen = base?.sistema?.[p] ?? null;
    const porCuota = cuota && volumen !== null ? cuota.mediana * volumen * f : null;

    const fijo = entradas.fijo?.[p];
    const tieneFijo = fijo !== null && fijo !== undefined && fijo !== "";
    const usado = tieneFijo
      ? Number(fijo)
      : p === "LVTA" && detalle?.delDetalle
        ? porFormula
        : via === "formula"
          ? porFormula
          : porCuota;

    salida[p] = {
      liquidado,
      porFormula,
      porCuota,
      usado,
      fijo: tieneFijo ? Number(fijo) : null,
      cuota,
      detalle,
      diferencia: usado !== null && liquidado !== null ? usado - liquidado : null,
    };
  }

  return { valores: v, defectos: d, procesos: salida, factor: f };
}

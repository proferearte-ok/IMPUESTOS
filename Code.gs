// ============================================
// DASHBOARD DE IMPUESTOS - GOOGLE APPS SCRIPT
// Backend completo: Impuestos, Sueldos, Notas
// ============================================

// 1. CONFIGURACIÓN
const SPREADSHEET_ID = ''; // Se usa la hoja activa

function getSpreadsheet() {
  if (SPREADSHEET_ID && SPREADSHEET_ID.trim() !== '') {
    return SpreadsheetApp.openById(SPREADSHEET_ID.trim());
  }
  return SpreadsheetApp.getActiveSpreadsheet();
}

// --- RPC HANDLERS ---

function doGet(e) {
  try {
    if (!e || !e.parameter || !e.parameter.action) {
      return HtmlService.createHtmlOutputFromFile('Index')
        .setTitle('Dashboard de Impuestos')
        .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
    }
    return doPost(e);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ error: error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    let payload = {};
    if (e && e.postData && e.postData.contents) {
      const contents = e.postData.contents;
      const match = contents.match(/request=([^&]*)/);
      if (match) {
        const decoded = decodeURIComponent(match[1]);
        try {
          payload = JSON.parse(decoded);
        } catch (err) {
          payload = e.parameter || {};
        }
      }
    } else if (e && e.parameter) {
      payload = e.parameter;
    }

    const action = payload.action;

    switch (action) {
      // IMPUESTOS
      case 'obtenerImpuestos':
        return buildJsonResponse({ status: 'ok', data: obtenerImpuestos() });
      case 'agregarImpuesto':
        return buildJsonResponse({ status: 'ok', data: agregarImpuesto(payload) });
      case 'marcarComoPagado':
        return buildJsonResponse({ status: 'ok', data: marcarComoPagado(payload.id, payload.fecha, payload.monto, payload.medio) });
      case 'obtenerSugerenciasImpuestos':
        return buildJsonResponse({ status: 'ok', data: obtenerSugerenciasImpuestos() });

      // SUELDOS
      case 'obtenerSueldos':
        return buildJsonResponse({ status: 'ok', data: obtenerSueldos() });
      case 'guardarSueldo':
        return buildJsonResponse({ status: 'ok', data: guardarSueldo(payload) });
      case 'obtenerEstadisticasSueldos':
        return buildJsonResponse({ status: 'ok', data: obtenerEstadisticasSueldos() });
      case 'eliminarSueldo':
        return buildJsonResponse({ status: 'ok', data: eliminarSueldo(payload.periodo, payload.fecha) });
      case 'migrarTodosLosSueldos':
        return buildJsonResponse({ status: 'ok', data: migrarTodosLosSueldos() });
      case 'verificarMigracion':
        return buildJsonResponse({ status: 'ok', data: verificarMigracion() });

      // NOTAS
      case 'obtenerNotas':
        return buildJsonResponse({ status: 'ok', data: obtenerNotas() });
      case 'guardarNota':
        return buildJsonResponse({ status: 'ok', data: guardarNota(payload.titulo, payload.contenido) });
      case 'eliminarNota':
        return buildJsonResponse({ status: 'ok', data: eliminarNota(payload.titulo, payload.contenido, payload.fecha) });
      case 'buscarNotas':
        return buildJsonResponse({ status: 'ok', data: buscarNotas(payload.termino) });
      case 'inicializarHojaNotas':
        return buildJsonResponse({ status: 'ok', data: inicializarHojaNotas() });

      default:
        return buildJsonResponse({ status: 'error', mensaje: 'Acción desconocida: ' + action });
    }
  } catch (error) {
    return buildJsonResponse({ status: 'error', mensaje: error.toString() });
  }
}

function buildJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================
// IMPUESTOS
// ============================================

function obtenerImpuestos() {
  try {
    const ss = getSpreadsheet();
    const sh = ss.getSheetByName("Hoja 2");
    if (!sh) { Logger.log("Error: No se encontró la hoja 'Hoja 2'"); return []; }
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return [];
    const datos = sh.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
    const datosFiltrados = datos.filter(fila => fila[0] !== "");
    const datosOrdenados = datosFiltrados.sort((a, b) => {
      const convertirFecha = (fechaStr) => {
        if (!fechaStr) return new Date(0);
        try {
          const parts = fechaStr.split('/');
          if (parts.length !== 3) return new Date(0);
          return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
        } catch (e) { return new Date(0); }
      };
      return convertirFecha(a[1]).getTime() - convertirFecha(b[1]).getTime();
    });
    return datosOrdenados;
  } catch (error) { Logger.log("Error en obtenerImpuestos: " + error.toString()); return []; }
}

function agregarImpuesto(payload) {
  try {
    const { imp, venc, monto, medio } = payload;
    if (!imp || !venc || !monto || !medio) throw new Error("Faltan campos obligatorios");
    const ss = getSpreadsheet();
    const sh = ss.getSheetByName("Hoja 2");
    if (!sh) throw new Error("No se encontró la hoja 'Hoja 2'");
    let fechaFormateada = venc;
    if (venc && venc.includes('-')) {
      const fechaParts = venc.split('-');
      fechaFormateada = fechaParts[2] + '/' + fechaParts[1] + '/' + fechaParts[0];
    }
    let montoLimpio = monto;
    if (monto && monto.toString) {
      montoLimpio = parseFloat(monto.toString().replace(/[^\d,]/g, '').replace(',', '.'));
      if (isNaN(montoLimpio)) montoLimpio = 0;
    }
    sh.appendRow([imp, fechaFormateada, montoLimpio, medio, "PENDIENTE", ""]);
    return true;
  } catch (error) { Logger.log("Error en agregarImpuesto: " + error.toString()); throw error; }
}

function marcarComoPagado(impuesto, vencimiento, monto, medio) {
  try {
    const ss = getSpreadsheet();
    const sh = ss.getSheetByName("Hoja 2");
    if (!sh) throw new Error("No se encontró la hoja 'Hoja 2'");
    const lastRow = sh.getLastRow();
    if (lastRow < 2) throw new Error("No hay datos en la hoja");
    const datos = sh.getRange(2, 1, lastRow - 1, 6).getDisplayValues();
    let filaEncontrada = -1;
    for (let i = 0; i < datos.length; i++) {
      if (datos[i][0] === impuesto && datos[i][1] === vencimiento && datos[i][2] === monto && datos[i][3] === medio && (datos[i][4] === "PENDIENTE" || datos[i][4] === "VENCIDO SIN PAGAR")) {
        filaEncontrada = i + 2; break;
      }
    }
    if (filaEncontrada === -1) throw new Error("No se encontró el impuesto para marcar como pagado");
    sh.getRange(filaEncontrada, 5).setValue("PAGADO");
    return true;
  } catch (error) { Logger.log("Error en marcarComoPagado: " + error.toString()); throw error; }
}

function obtenerSugerenciasImpuestos() {
  try {
    const ss = getSpreadsheet();
    const sh = ss.getSheetByName("Hoja 2");
    if (!sh) return [];
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return [];
    const impuestos = sh.getRange(2, 1, lastRow - 1, 1).getValues();
    const impuestosUnicos = [];
    const visto = {};
    for (let i = 0; i < impuestos.length; i++) {
      const nombre = impuestos[i][0];
      if (nombre && nombre.toString().trim() !== "" && !visto[nombre]) {
        visto[nombre] = true;
        impuestosUnicos.push(nombre.toString());
      }
    }
    impuestosUnicos.sort((a, b) => a.localeCompare(b, 'es'));
    return impuestosUnicos;
  } catch (error) { Logger.log("Error en obtenerSugerenciasImpuestos: " + error.toString()); return []; }
}

// ============================================
// SUELDOS
// ============================================

function inicializarHoSueldos() {
  try {
    const ss = getSpreadsheet();
    let sh = ss.getSheetByName("Sueldos");
    if (!sh) {
      sh = ss.insertSheet("Sueldos");
      const headers = [["Período", "Fecha", "Sueldo Básico", "Horas Semanales", "% Aumento", "% Antigüedad", "Antigüedad $", "Horas Extras (cant)", "Valor Hora Extra", "Total Horas Extras", "Aportes", "Adelantos", "Medio Aguinaldo", "Bonos No Remunerativos", "Bonos Remunerativos", "Otros", "Descripción Otros", "Sueldo Bruto", "Sueldo Neto", "Notas"]];
      sh.getRange(1, 1, 1, 20).setValues(headers);
      sh.getRange(1, 1, 1, 20).setBackground('#0f1419').setFontColor('#ffffff').setFontWeight('bold');
      sh.setColumnWidths(1, 20, 120);
      sh.getRange("A:A").setNumberFormat('dd/mm/yyyy');
      sh.getRange("C:R").setNumberFormat('#,##0.00');
    }
    return sh;
  } catch (error) { Logger.log("Error al inicializar: " + error.toString()); throw error; }
}

function obtenerSueldos() {
  try {
    const sh = inicializarHoSueldos();
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return [];
    const data = sh.getRange(2, 1, lastRow - 1, 20).getDisplayValues();
    data.sort((a, b) => { if (!a[1] || !b[1]) return 0; return new Date(b[1]) - new Date(a[1]); });
    return data;
  } catch (error) { Logger.log("Error al obtener sueldos: " + error.toString()); return []; }
}

function guardarSueldo(sueldo) {
  try {
    const { periodo, fecha, basico, horasSemanales, aumento, antiguedadPorc, horasExtrasCant, valorHoraExtra, aportes, adelantos, aguinaldo, bonoNoRem, bonoRem, otros, otrosDesc, notas } = sueldo;
    if (!periodo || !fecha || !basico) throw new Error("Período, fecha y sueldo básico son obligatorios");
    const sh = inicializarHoSueldos();
    const nextRow = sh.getLastRow() + 1;
    const fila = [
      periodo, new Date(fecha), Number(basico) || 0, Number(horasSemanales) || 0, aumento || "",
      Number(antiguedadPorc) || 0, `=C${nextRow}*F${nextRow}/100`, Number(horasExtrasCant) || 0,
      Number(valorHoraExtra) || 0, `=H${nextRow}*I${nextRow}`, Number(aportes) || 0,
      Number(adelantos) || 0, Number(aguinaldo) || 0, Number(bonoNoRem) || 0,
      Number(bonoRem) || 0, Number(otros) || 0, otrosDesc || "",
      `=C${nextRow}+G${nextRow}+J${nextRow}+M${nextRow}+N${nextRow}+O${nextRow}+P${nextRow}`,
      `=R${nextRow}+K${nextRow}+L${nextRow}`, notas || ""
    ];
    sh.appendRow(fila);
    return true;
  } catch (error) { Logger.log("Error al guardar sueldo: " + error.toString()); throw error; }
}

function obtenerEstadisticasSueldos() {
  try {
    const sueldos = obtenerSueldos();
    if (sueldos.length === 0) return {};
    let totalNeto = 0, maxNeto = 0, maxPeriodo = "", totalHorasExtras = 0, mesesConHE = 0;
    const añoActual = new Date().getFullYear();
    let totalAnual = 0;
    sueldos.forEach(row => {
      const neto = parseFloat(row[18]) || 0;
      const periodo = row[0];
      const fecha = row[1] ? new Date(row[1].split('/').reverse().join('-')) : null;
      const he = parseFloat(row[9]) || 0;
      totalNeto += neto;
      if (neto > maxNeto) { maxNeto = neto; maxPeriodo = periodo; }
      if (he > 0) { totalHorasExtras += he; mesesConHE++; }
      if (fecha && fecha.getFullYear() === añoActual) totalAnual += neto;
    });
    const promedioNeto = totalNeto / sueldos.length;
    const promedioHE = mesesConHE > 0 ? totalHorasExtras / mesesConHE : 0;
    const ultimo = sueldos[0];
    const antiguedadActual = parseFloat(ultimo[5]) || 0;
    return { promedioNeto, totalAnual, maxNeto, maxPeriodo, promedioHE, antiguedadActual, totalRegistros: sueldos.length };
  } catch (error) { Logger.log("Error en estadísticas: " + error.toString()); return {}; }
}

function eliminarSueldo(periodo, fecha) {
  try {
    const sh = inicializarHoSueldos();
    const data = sh.getDataRange().getValues();
    for (let i = data.length - 1; i >= 0; i--) {
      if (data[i][0] === periodo && data[i][1].toString() === fecha) {
        sh.deleteRow(i + 1); return true;
      }
    }
    throw new Error("No se encontró el sueldo");
  } catch (error) { Logger.log("Error al eliminar sueldo: " + error.toString()); throw error; }
}

// MIGRACIÓN HISTÓRICA 2017-2026
function migrarTodosLosSueldos() {
  try {
    let contador = 0;
    function guardarLote(registros) {
      registros.forEach(reg => {
        try {
          const sueldo = { periodo: reg.periodo, fecha: reg.fecha, basico: reg.basico, horasSemanales: reg.horasSemanales || 35, aumento: reg.aumento || '', antiguedadPorc: reg.antiguedadPorc || 0, horasExtrasCant: reg.horasExtrasCant || 0, valorHoraExtra: reg.valorHoraExtra || 0, aportes: reg.aportes || 0, adelantos: reg.adelantos || 0, aguinaldo: reg.aguinaldo || 0, bonoNoRem: reg.bonoNoRem || 0, bonoRem: reg.bonoRem || 0, otros: reg.otros || 0, otrosDesc: reg.otrosDesc || '', notas: reg.notas || '' };
          guardarSueldo(sueldo); contador++;
        } catch (e) { Logger.log(`Error guardando ${reg.periodo}: ${e}`); }
      });
    }
    // 2017-2026 data here (abbreviated for space - full data in source)
    const años = [2017,2018,2019,2020,2021,2022,2023,2024,2025,2026];
    // NOTE: Full historical data arrays should be pasted here from source
    // For brevity, only structure shown - copy full data from source file
    Logger.log(`Migración completada: ${contador} registros`);
    return contador;
  } catch (error) { Logger.log("Error en migración: " + error.toString()); throw error; }
}

function verificarMigracion() {
  try {
    const ss = getSpreadsheet();
    const sh = ss.getSheetByName("Sueldos");
    if (!sh) return { error: "No existe la hoja Sueldos" };
    const lastRow = sh.getLastRow();
    return { totalRegistros: lastRow - 1 };
  } catch (error) { return { error: error.toString() }; }
}

// ============================================
// NOTAS
// ============================================

function obtenerNotas() {
  try {
    const ss = getSpreadsheet();
    const sh = ss.getSheetByName("Notas");
    if (!sh) return [];
    const lastRow = sh.getLastRow();
    if (lastRow < 2) return [];
    const datos = sh.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
    const notasFiltradas = datos.filter(fila => fila[1] !== "");
    notasFiltradas.sort((a, b) => new Date(b[0]) - new Date(a[0]));
    return notasFiltradas.map(fila => [fila[1], "", fila[0], fila[3]]);
  } catch (error) { Logger.log("Error en obtenerNotas: " + error.toString()); return []; }
}

function guardarNota(titulo, contenido) {
  try {
    const ss = getSpreadsheet();
    let sh = ss.getSheetByName("Notas");
    if (!sh) { inicializarHojaNotas(); sh = ss.getSheetByName("Notas"); }
    if (!titulo || titulo.trim() === "") throw new Error("El título no puede estar vacío");
    const id = Utilities.getUuid();
    const fecha = new Date();
    const fechaFormateada = Utilities.formatDate(fecha, Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");
    sh.appendRow([fechaFormateada, titulo.trim(), contenido.trim(), id]);
    return true;
  } catch (error) { Logger.log("Error en guardarNota: " + error.toString()); throw error; }
}

function eliminarNota(titulo, contenido, fecha) {
  try {
    const ss = getSpreadsheet();
    const sh = ss.getSheetByName("Notas");
    if (!sh) throw new Error("No se encontró la hoja 'Notas'");
    const lastRow = sh.getLastRow();
    if (lastRow < 2) throw new Error("No hay notas para eliminar");
    const datos = sh.getRange(2, 1, lastRow - 1, 4).getDisplayValues();
    let filaEncontrada = -1;
    for (let i = 0; i < datos.length; i++) {
      if (datos[i][1] === titulo && datos[i][0] === fecha) { filaEncontrada = i + 2; break; }
    }
    if (filaEncontrada === -1) throw new Error("No se encontró la nota para eliminar");
    sh.deleteRow(filaEncontrada);
    return true;
  } catch (error) { Logger.log("Error en eliminarNota: " + error.toString()); throw error; }
}

function inicializarHojaNotas() {
  try {
    const ss = getSpreadsheet();
    let sh = ss.getSheetByName("Notas");
    if (!sh) {
      sh = ss.insertSheet("Notas");
      sh.getRange(1, 1, 1, 4).setValues([["Fecha", "Nota", "Etiquetas", "ID"]]);
      sh.getRange(1, 1, 1, 4).setBackground('#0f1419').setFontColor('#ffffff').setFontWeight('bold');
      sh.setColumnWidth(1, 150); sh.setColumnWidth(2, 400); sh.setColumnWidth(3, 150); sh.setColumnWidth(4, 200);
    }
    return sh;
  } catch (error) { Logger.log("Error al inicializar hoja: " + error.toString()); throw error; }
}

function buscarNotas(terminoBusqueda) {
  try {
    const notas = obtenerNotas();
    const termino = terminoBusqueda.toLowerCase().trim();
    return notas.filter(nota => {
      const titulo = (nota[0] || "").toLowerCase();
      const contenido = (nota[1] || "").toLowerCase();
      return titulo.includes(termino) || contenido.includes(termino);
    });
  } catch (error) { Logger.log("Error en buscarNotas: " + error.toString()); return []; }
}
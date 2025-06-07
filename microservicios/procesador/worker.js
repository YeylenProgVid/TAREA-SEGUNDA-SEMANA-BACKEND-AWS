const { parentPort, workerData } = require("worker_threads");
const axios = require("axios");

async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generarFactura(intento = 1) {
  const { residente, token } = workerData;
  const factura = {
    residenteId: residente.residenteId,
    pagoId: residente.pagoId,
    unidad: residente.unidad,
    concepto: residente.concepto,
    monto: residente.monto,
    fechaEmision: residente.fechaEmision,
    fechaPago: residente.fechaPago,
    estado: residente.estado,
  };

  try {
    const respuesta = await axios.post("http://nginx/facturacion/", factura, {
      //Anterior const respuesta = await axios.post("http://facturacion:3003/", factura,
      headers: { Authorization: token },
      timeout: 5000, // Protección contra cuelgues largos
    });

    if (respuesta.status === 201) {
      parentPort.postMessage({
        success: true,
        residenteId: residente.residenteId,
        facturaId: respuesta.data?.id || "desconocido",
      });
    } else {
      throw new Error(`Código inesperado: ${respuesta.status}`);
    }
  } catch (error) {
    console.error(
      `Intento ${intento} fallido para ${residente.residenteId}:`,
      error.message
    );

    if (intento < 3) {
      const delayMs = 300 * intento; // Retry con delay incremental
      console.log(`⏳ Reintentando en ${delayMs}ms...`);
      await delay(delayMs);
      return generarFactura(intento + 1); // Reintenta
    }

    // Si falla todos los intentos
    parentPort.postMessage({
      success: false,
      residenteId: residente.residenteId,
      error: error.response?.data || error.message,
    });

    await fs.appendFile(
      "errores.log",
      JSON.stringify({
        id: residente.residenteId,
        error: error.response?.data || error.message,
        fecha: new Date().toISOString(),
      }) + "\n"
    );
  }
}

generarFactura();

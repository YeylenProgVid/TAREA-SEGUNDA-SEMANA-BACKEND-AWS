const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const Joi = require("joi");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const axios = require("axios");
const os = require("os"); //para obtener nombre del contenedor NUEVO ----

const app = express();
const PORT = 3003;
const ARCHIVO = path.join(__dirname, "datos.json");
const SECRET = "CLAVESECRETA123";

app.use(express.json());

// Middleware para validar token
function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token no proporcionado" });

  try {
    const decoded = jwt.verify(token, SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
}

async function verificarResidente(id, token) {
  try {
    console.log(id, token);

    const res = await axios.get(`http://residentes:3001/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (error) {
    console.error(
      "Error al consultar residente:",
      error.response?.data || error.message
    );
    // Voy a comentar esto porque me sirvio para encontrar un errorif (error.response) {
    //   // El servidor respondió con un código de estado fuera del rango 2xx
    //   console.error(" Data:", error.response.data);
    //   console.error(" Status:", error.response.status);
    //   console.error(" Headers:", error.response.headers);
    // } else if (error.request) {
    //   // La solicitud fue hecha pero no hubo respuesta
    //   console.error(" Request:", error.request);
    // } else {
    //   // Algo ocurrió al configurar la solicitud
    //   console.error(" Error:", error.message);
    // }

    return null;
  }
}

async function verificarPago(id, token) {
  try {
    const res = await axios.get(`http://pagos:3002/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (error) {
    console.error(
      "Error al consultar el pago:",
      error.response?.data || error.message
    );
    return null;
  }
}

async function enviarNotificacion(tipo, mensaje, token) {
  try {
    const notificacion = {
      tipo,
      mensaje,
      fecha: new Date().toISOString(),
    };

    await axios.post("http://notificador:3004/", notificacion, {
      headers: { Authorization: `Bearer ${token}` },
    });

    console.log("Notificación enviada al microservicio Notificador");
  } catch (error) {
    console.error(
      "Error al enviar la notificación:",
      error.response?.data || error.message
    );
  }
}

// Esquema Joi
const esquemaFactura = Joi.object({
  residenteId: Joi.string().required(),
  pagoId: Joi.string().required(),
  unidad: Joi.string().required(),
  concepto: Joi.string().required(),
  monto: Joi.number().greater(0).required(),
  fechaEmision: Joi.date().iso().required(),
  fechaPago: Joi.date().iso().optional().allow(null),
  estado: Joi.string().valid("pendiente", "pagado").required(),
});

// Rutas protegidas con JWT

app.get("/", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const facturas = JSON.parse(datos);

    const instancia = os.hostname(); //devuelve "facturacion1" o "facturacion2" NUEVO ---------
    res.json({ instancia, total: facturas.length, facturas }); //Le Agregue esto instancia, total: facturas.length,
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al leer las facturas", detalle: error.message });
  }
});

app.get("/:id", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const facturas = JSON.parse(datos);
    const factura = facturas.find((f) => f.id == req.params.id);
    if (!factura)
      return res.status(404).json({ error: "Factura no encontrada" });
    res.json(factura);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al buscar la factura", detalle: error.message });
  }
});

app.post("/", verificarToken, async (req, res) => {
  try {
    const { error, value } = esquemaFactura.validate(req.body, {
      abortEarly: false,
    });
    if (error)
      return res.status(400).json({
        error: "Datos inválidos",
        detalles: error.details.map((d) => d.message),
      });

    //  Verificar existencia del residente
    const token = req.headers.authorization?.split(" ")[1];
    const residente = await verificarResidente(value.residenteId, token);
    if (!residente) {
      return res
        .status(400)
        .json({ error: "Residente no válido o no encontrado" });
    }

    // Verificar pago
    const pago = await verificarPago(value.pagoId, token);
    if (!pago) {
      return res.status(400).json({ error: "Pago no válido o no encontrado" });
    }

    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const facturas = JSON.parse(datos);
    const instancia = os.hostname(); //devuelve "facturacion1" o "facturacion2" NUEVO ---------

    const nueva = { id: uuidv4(), ...value };
    facturas.push(nueva);

    await fs.writeFile(ARCHIVO, JSON.stringify(facturas, null, 2));

    // Llamar al notificador
    await enviarNotificacion(
      "factura",
      `Se ha registrado una nueva factura para la unidad ${value.unidad}`,
      token
    );

    res.status(201).json({ instancia, total: facturas.length, nueva }); //res.status(201).json(nueva); vieja
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al agregar la factura", detalle: error.message });
  }
});

app.put("/:id", verificarToken, async (req, res) => {
  try {
    const { error, value } = esquemaFactura.validate(req.body, {
      abortEarly: false,
    });

    if (error)
      return res.status(400).json({
        error: "Datos inválidos",
        detalles: error.details.map((d) => d.message),
      });

    const token = req.headers.authorization?.split(" ")[1];

    // Verificar residente
    const residente = await verificarResidente(value.residenteId, token);
    if (!residente) {
      return res
        .status(400)
        .json({ error: "Residente no válido o no encontrado" });
    }

    // Verificar pago
    const pago = await verificarPago(value.pagoId, token);
    if (!pago) {
      return res.status(400).json({ error: "Pago no válido o no encontrado" });
    }

    // Leer archivo y buscar factura
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const facturas = JSON.parse(datos);
    const index = facturas.findIndex((f) => f.id == req.params.id);

    if (index === -1)
      return res.status(404).json({ error: "Factura no encontrada" });

    facturas[index] = { ...facturas[index], ...value };

    await fs.writeFile(ARCHIVO, JSON.stringify(facturas, null, 2));
    res.json(facturas[index]);
  } catch (error) {
    res.status(500).json({
      error: "Error al actualizar la factura",
      detalle: error.message,
    });
  }
});

app.delete("/:id", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    let facturas = JSON.parse(datos);
    const original = facturas.length;
    facturas = facturas.filter((f) => f.id != req.params.id);
    if (facturas.length === original)
      return res.status(404).json({ error: "Factura no encontrada" });

    await fs.writeFile(ARCHIVO, JSON.stringify(facturas, null, 2));
    res.status(204).send();
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al eliminar la factura", detalle: error.message });
  }
});

// Ruta pública
app.get("/prueba", (req, res) => {
  res.send(
    "Esto es una prueba para que se vea como funciona el get de facturacion"
  );
});

app.listen(PORT, () =>
  console.log(
    `El puerto en el que esta el microservicio facturacion es el ${PORT}`
  )
);

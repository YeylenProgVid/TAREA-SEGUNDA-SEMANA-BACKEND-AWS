const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const Joi = require("joi");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");
const axios = require("axios");

const app = express();
const PORT = 3002;
const ARCHIVO = path.join(__dirname, "datos.json");
const SECRET = "CLAVESECRETA123";

app.use(express.json());

// Middleware para verificar token JWT
function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) {
    return res.status(401).json({ error: "Token no proporcionado" });
  }

  try {
    const verificado = jwt.verify(token, SECRET);
    req.usuario = verificado;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
}

async function verificarResidente(id, token) {
  try {
    const res = await axios.get(`http://residentes:3001/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.data;
  } catch (error) {
    console.error(
      "Ha ocurrido un error al consultar el residente",
      error.response?.data || error.message
    );
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

// Esquema de validación con Joi
const esquemaPago = Joi.object({
  residenteId: Joi.string().required().messages({
    "string.base": `"residenteId" debe ser texto`,
    "any.required": `"residenteId" es obligatorio`,
  }),
  monto: Joi.number().greater(0).required().messages({
    "number.base": `"monto" debe ser numérico`,
    "number.greater": `"monto" debe ser mayor a 0`,
    "any.required": `"monto" es obligatorio`,
  }),
  fecha: Joi.date().iso().required().messages({
    "date.base": `"fecha" debe ser una fecha válida`,
    "date.format": `"fecha" debe tener formato ISO`,
    "any.required": `"fecha" es obligatoria`,
  }),
  estado: Joi.string().valid("pendiente", "pagado").required().messages({
    "any.only": `"estado" debe ser "pendiente" o "pagado"`,
    "any.required": `"estado" es obligatorio`,
  }),
});

// Consultar todos los pagos
app.get("/", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const pagos = JSON.parse(datos);
    res.json(pagos);
  } catch (error) {
    res.status(500).json({
      error: "Error al leer los pagos",
      detalle: error.message,
    });
  }
});

// Consultar un pago por ID
app.get("/:id", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const pagos = JSON.parse(datos);
    const pago = pagos.find((p) => p.id == req.params.id);
    if (!pago) return res.status(404).json({ error: "Pago no encontrado" });
    res.json(pago);
  } catch (error) {
    res.status(500).json({
      error: "Error al buscar el pago",
      detalle: error.message,
    });
  }
});

// Agregar nuevo pago
app.post("/", verificarToken, async (req, res) => {
  try {
    const { error, value } = esquemaPago.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        error: "Datos inválidos",
        detalles: error.details.map((d) => d.message),
      });
    }

    //  Verificar existencia del residente
    const token = req.headers.authorization?.split(" ")[1];
    const residente = await verificarResidente(value.residenteId, token);
    if (!residente) {
      return res
        .status(400)
        .json({ error: "Residente no válido o no encontrado" });
    }

    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const pagos = JSON.parse(datos);

    const nuevo = { id: uuidv4(), ...value };
    pagos.push(nuevo);

    await fs.writeFile(ARCHIVO, JSON.stringify(pagos, null, 2));
    // Llamar al notificador
    await enviarNotificacion(
      "pago",
      `Se ha registrado una nuevo pago del residente ${value.residenteId}`,
      token
    );
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(500).json({
      error: "Error al agregar el pago",
      detalle: error.message,
    });
  }
});

// Actualizar un pago por ID
app.put("/:id", verificarToken, async (req, res) => {
  try {
    const { error, value } = esquemaPago.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        error: "Datos inválidos",
        detalles: error.details.map((d) => d.message),
      });
    }

    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const pagos = JSON.parse(datos);
    const index = pagos.findIndex((p) => p.id == req.params.id);

    if (index === -1) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    pagos[index] = { ...pagos[index], ...value }; // No se cambia el ID
    await fs.writeFile(ARCHIVO, JSON.stringify(pagos, null, 2));

    res.json(pagos[index]);
  } catch (error) {
    res.status(500).json({
      error: "Error al actualizar el pago",
      detalle: error.message,
    });
  }
});

// Eliminar un pago por ID
app.delete("/:id", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    let pagos = JSON.parse(datos);
    const tamanioOriginal = pagos.length;

    pagos = pagos.filter((p) => p.id != req.params.id);

    if (pagos.length === tamanioOriginal)
      return res.status(404).json({ error: "Pago no encontrado" });

    await fs.writeFile(ARCHIVO, JSON.stringify(pagos, null, 2));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: "Error al eliminar el pago",
      detalle: error.message,
    });
  }
});

// Rutas públicas
app.get("/prueba", (req, res) => {
  res.send("Esto es una prueba para que se vea como funciona el get de pagos");
});

app.get("/", (req, res) => {
  res.send("Ya tenemos el microservicio de pagos habilidado");
});

app.listen(PORT, () => console.log(`El puerto de los pagos es el ${PORT}`));

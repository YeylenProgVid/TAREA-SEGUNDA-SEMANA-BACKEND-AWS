const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const Joi = require("joi");
const { v4: uuidv4 } = require("uuid");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3004;
const ARCHIVO = path.join(__dirname, "datos.json");
const SECRET = "CLAVESECRETA123";

app.use(express.json());

// Middleware para verificar el token
function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token no proporcionado" });

  try {
    const verificado = jwt.verify(token, SECRET);
    req.usuario = verificado;
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
}

// Validación Joi
const esquemaNotificacion = Joi.object({
  tipo: Joi.string().valid("pago", "factura", "recordatorio").required(),
  mensaje: Joi.string().min(5).required(),
  fecha: Joi.date().iso().required(),
});

// Consultar todas las notificaciones
app.get("/", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const notificaciones = JSON.parse(datos);
    res.json(notificaciones);
  } catch (error) {
    res.status(500).json({
      error: "Error al leer las notificaciones",
      detalle: error.message,
    });
  }
});

// Obtener notificación por ID
app.get("/:id", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const notificaciones = JSON.parse(datos);
    const nota = notificaciones.find((n) => n.id == req.params.id);
    if (!nota)
      return res.status(404).json({ error: "Notificación no encontrada" });
    res.json(nota);
  } catch (error) {
    res.status(500).json({
      error: "Error al buscar la notificación",
      detalle: error.message,
    });
  }
});

// Crear nueva notificación
app.post("/", verificarToken, async (req, res) => {
  try {
    const { error, value } = esquemaNotificacion.validate(req.body, {
      abortEarly: false,
    });
    if (error)
      return res.status(400).json({
        error: "Datos inválidos",
        detalles: error.details.map((d) => d.message),
      });

    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const notificaciones = JSON.parse(datos);

    const nueva = { id: uuidv4(), ...value };
    notificaciones.push(nueva);

    await fs.writeFile(ARCHIVO, JSON.stringify(notificaciones, null, 2));
    res.status(201).json(nueva);
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al agregar notificación", detalle: error.message });
  }
});

// Actualizar notificación
app.put("/:id", verificarToken, async (req, res) => {
  try {
    const { error, value } = esquemaNotificacion.validate(req.body, {
      abortEarly: false,
    });
    if (error)
      return res.status(400).json({
        error: "Datos inválidos",
        detalles: error.details.map((d) => d.message),
      });

    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const notificaciones = JSON.parse(datos);
    const index = notificaciones.findIndex((n) => n.id == req.params.id);

    if (index === -1)
      return res.status(404).json({ error: "Notificación no encontrada" });

    notificaciones[index] = { ...notificaciones[index], ...value };

    await fs.writeFile(ARCHIVO, JSON.stringify(notificaciones, null, 2));
    res.json(notificaciones[index]);
  } catch (error) {
    res.status(500).json({
      error: "Error al actualizar notificación",
      detalle: error.message,
    });
  }
});

// Eliminar
app.delete("/:id", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    let notificaciones = JSON.parse(datos);
    const original = notificaciones.length;
    notificaciones = notificaciones.filter((n) => n.id != req.params.id);
    if (notificaciones.length === original)
      return res.status(404).json({ error: "Notificación no encontrada" });

    await fs.writeFile(ARCHIVO, JSON.stringify(notificaciones, null, 2));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: "Error al eliminar notificación",
      detalle: error.message,
    });
  }
});

// Ruta pública de prueba
app.get("/prueba", (req, res) => {
  res.send(
    "Esto es una prueba para que se vea como funciona el get de notificador"
  );
});

app.listen(PORT, () =>
  console.log(`El puerto del microservicio notificador es: ${PORT}`)
);

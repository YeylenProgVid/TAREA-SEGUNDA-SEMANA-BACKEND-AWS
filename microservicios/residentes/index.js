const express = require("express");
const fs = require("fs/promises");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const Joi = require("joi");
const jwt = require("jsonwebtoken");

const app = express();
const PORT = 3001;
const ARCHIVO = path.join(__dirname, "datos.json");
const SECRET = "CLAVESECRETA123"; // Idealmente usar variable de entorno

app.use(express.json());

// Middleware para verificar el token JWT
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

// Validación con Joi
const esquemaResidente = Joi.object({
  nombre: Joi.string().min(3).required().messages({
    "string.base": `"nombre" debe ser texto`,
    "string.min": `"nombre" debe tener al menos 3 caracteres`,
    "any.required": `"nombre" es obligatorio`,
  }),
  apartamento: Joi.string().required().messages({
    "string.base": `"apartamento" debe ser texto`,
    "any.required": `"apartamento" es obligatorio`,
  }),
  telefono: Joi.string()
    .pattern(/^[0-9]{10}$/)
    .required()
    .messages({
      "string.pattern.base": `"telefono" debe tener 10 dígitos numéricos`,
      "any.required": `"telefono" es obligatorio`,
    }),
});

// Rutas protegidas

// GET todos
app.get("/", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const residentes = JSON.parse(datos);
    res.json(residentes);
  } catch (error) {
    res.status(500).json({
      error: "Error al localizar los datos de los residentes",
      detalle: error.message,
    });
  }
});

// GET por ID
app.get("/:id", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const residentes = JSON.parse(datos);
    const residente = residentes.find((r) => r.id == req.params.id);
    if (!residente)
      return res.status(404).json({ error: "El residente no fue encontrado" });
    res.json(residente);
  } catch (error) {
    res.status(500).json({
      error: "Error al buscar el residente",
      detalle: error.message,
    });
  }
});

// POST
app.post("/", verificarToken, async (req, res) => {
  try {
    const { error, value } = esquemaResidente.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        error: "Datos inválidos",
        detalles: error.details.map((d) => d.message),
      });
    }

    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const residentes = JSON.parse(datos);
    const nuevo = { id: uuidv4(), ...value };

    residentes.push(nuevo);
    await fs.writeFile(ARCHIVO, JSON.stringify(residentes, null, 2));
    res.status(201).json(nuevo);
  } catch (error) {
    res.status(500).json({
      error: "Error al agregar el residente",
      detalle: error.message,
    });
  }
});

// PUT
app.put("/:id", verificarToken, async (req, res) => {
  try {
    const { error, value } = esquemaResidente.validate(req.body, {
      abortEarly: false,
    });

    if (error) {
      return res.status(400).json({
        error: "Datos inválidos",
        detalles: error.details.map((d) => d.message),
      });
    }

    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const residentes = JSON.parse(datos);
    const indice = residentes.findIndex((r) => r.id == req.params.id);

    if (indice === -1)
      return res.status(404).json({ error: "Residente no encontrado" });

    residentes[indice] = {
      ...residentes[indice],
      ...value,
    };

    await fs.writeFile(ARCHIVO, JSON.stringify(residentes, null, 2));
    res.json(residentes[indice]);
  } catch (error) {
    res.status(500).json({
      error: "Error al actualizar el residente",
      detalle: error.message,
    });
  }
});

// DELETE
app.delete("/:id", verificarToken, async (req, res) => {
  try {
    const datos = await fs.readFile(ARCHIVO, "utf-8");
    let residentes = JSON.parse(datos);
    const tamanioOriginal = residentes.length;

    residentes = residentes.filter((r) => r.id != req.params.id);

    if (residentes.length === tamanioOriginal)
      return res.status(404).json({ error: "Residente no encontrado" });

    await fs.writeFile(ARCHIVO, JSON.stringify(residentes, null, 2));
    res.status(204).send();
  } catch (error) {
    res.status(500).json({
      error: "Error al eliminar el residente",
      detalle: error.message,
    });
  }
});

// Ruta pública
app.get("/prueba", (req, res) => {
  res.send("Esto es una prueba pública del servicio de residentes.");
});

app.listen(PORT, () =>
  console.log(`Servicio de residentes escuchando en puerto ${PORT}`)
);

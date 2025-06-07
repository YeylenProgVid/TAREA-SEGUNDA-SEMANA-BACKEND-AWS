const express = require("express");
const path = require("path");
const jwt = require("jsonwebtoken");
const { Worker } = require("worker_threads");

const app = express();
const PORT = 3006;
const SECRET = "CLAVESECRETA123";

app.use(express.json());

function verificarToken(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(401).json({ error: "Token no proporcionado" });

  try {
    req.usuario = jwt.verify(token, SECRET);
    next();
  } catch (error) {
    return res.status(403).json({ error: "Token inválido o expirado" });
  }
}

const MAX_CONCURRENT_WORKERS = 3;
let activeWorkers = 0;
let queue = [];

// Delay no bloqueante
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function ejecutarWorker({ residente, token, intentos = 1 }) {
  activeWorkers++;

  const worker = new Worker(path.join(__dirname, "worker.js"), {
    workerData: { residente, token },
  });

  worker.on("message", (msg) => {
    console.log("Tarea completada:", msg.residenteId);
  });

  worker.on("error", (err) => {
    console.error(`Error en worker (intento ${intentos}):`, err.message);

    // Reintentar hasta 3 veces
    if (intentos < 3) {
      console.log("🔁 Reintentando tarea para:", residente.residenteId);
      queue.push({ residente, token, intentos: intentos + 1 });
    }
  });

  worker.on("exit", async () => {
    activeWorkers--;

    await delay(300); // Delay antes del siguiente

    if (queue.length > 0) {
      const siguiente = queue.shift();
      ejecutarWorker(siguiente);
    }
  });
}

app.post("/generar-facturas", verificarToken, async (req, res) => {
  try {
    const residentes = req.body.residentes;
    console.log(residentes);
    const token = req.headers.authorization;

    if (!Array.isArray(residentes) || residentes.length === 0) {
      return res.status(400).json({ error: "Lista de residentes requerida" });
    }

    // Cargar la cola con intentos = 1
    queue = residentes.map((residente) => ({
      residente,
      token,
      intentos: 1,
    }));

    // Lanzar los primeros N workers
    for (let i = 0; i < Math.min(MAX_CONCURRENT_WORKERS, queue.length); i++) {
      const tarea = queue.shift();
      ejecutarWorker(tarea);
    }

    res.json({ mensaje: "Facturación iniciada para todos los residentes" });
  } catch (error) {
    res.status(500).json({
      error: "Error al iniciar procesamiento",
      detalle: error.message,
    });
  }
});

app.listen(PORT, () =>
  console.log(`Microservicio procesador escuchando en el puerto ${PORT}`)
);

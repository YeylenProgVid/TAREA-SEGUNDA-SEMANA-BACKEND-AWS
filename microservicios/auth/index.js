const express = require("express");
const fs = require("fs/promises");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

const app = express();
const PORT = 3005;

const ARCHIVO = path.join(__dirname, "datos.json");
const SECRET = "CLAVESECRETA123";

app.use(cors());
app.use(express.json());

/**
 * Registrar nuevo usuario (encripta la contraseña)
 */
app.post("/register", async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    // Validación mínima
    if (!correo || !contrasena) {
      return res
        .status(400)
        .json({ error: "Correo y contraseña son obligatorios" });
    }

    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const usuarios = JSON.parse(datos);

    const yaExiste = usuarios.some((u) => u.correo === correo);
    if (yaExiste) {
      return res
        .status(400)
        .json({ error: "Ya existe un usuario con ese correo" });
    }

    const hash = bcrypt.hashSync(contrasena, 10);
    const nuevoUsuario = { id: uuidv4(), correo, contrasena: hash };
    usuarios.push(nuevoUsuario);

    await fs.writeFile(ARCHIVO, JSON.stringify(usuarios, null, 2));
    res.status(201).json({ mensaje: "Usuario registrado correctamente" });
  } catch (error) {
    res
      .status(500)
      .json({ error: "Error al registrar usuario", detalle: error.message });
  }
});

/**
 * Login de usuario (valida contraseña y genera token)
 */
app.post("/login", async (req, res) => {
  try {
    const { correo, contrasena } = req.body;

    const datos = await fs.readFile(ARCHIVO, "utf-8");
    const usuarios = JSON.parse(datos);

    const usuario = usuarios.find((u) => u.correo === correo);
    if (!usuario || !bcrypt.compareSync(contrasena, usuario.contrasena)) {
      return res.status(401).json({ error: "Credenciales incorrectas" });
    }

    const token = jwt.sign({ id: usuario.id, correo: usuario.correo }, SECRET, {
      expiresIn: "2h",
    });

    res.json({ token });
  } catch (error) {
    res.status(500).json({
      error: "Error interno al intentar autenticar",
      detalle: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor de autenticación en el puerto ${PORT}`);
});

const axios = require("axios");

const BASE_URL = "http://localhost:3000";

const usuario = {
  nombre: "Tester Script",
  correo: `test${Date.now()}@condo.com`, // único cada vez
  contrasena: "claveSegura123",
};

const residentes = Array.from({ length: 10 }, (_, i) => ({
  residenteId: `${i + 1}`,
  pagoId: `${i + 1}`,
  unidad: `A-${i + 1}`,
  concepto: "Mantenimiento mensual",
  monto: 1000 + i * 100,
  fechaEmision: new Date().toISOString(),
  fechaPago: null,
  estado: "pendiente",
}));

async function registrarUsuario() {
  try {
    const res = await axios.post(`${BASE_URL}/auth/register`, usuario);
    console.log("Usuario registrado:", res.data);
  } catch (error) {
    if (error.response?.status === 409) {
      console.log("Usuario ya existe. Continuando...");
    } else {
      console.error(
        "Error al registrar:",
        error.response?.data || error.message
      );
      throw error;
    }
  }
}

async function iniciarSesion() {
  const res = await axios.post(`${BASE_URL}/auth/login`, {
    correo: usuario.correo,
    contrasena: usuario.contrasena,
  });

  const token = res.data.token;
  console.log("Token obtenido:", token);
  return token;
}

async function lanzarCarga(token) {
  try {
    const res = await axios.post(
      `${BASE_URL}/procesador/generar-facturas`,
      { residentes },
      {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      }
    );
    console.log("Respuesta del procesador:");
    console.log(res.data);
  } catch (error) {
    console.error("Error al hacer la petición:");
    console.error(error.response?.data || error.message);
  }
}

async function main() {
  await registrarUsuario();
  const token = await iniciarSesion();
  await lanzarCarga(token);
}

main();

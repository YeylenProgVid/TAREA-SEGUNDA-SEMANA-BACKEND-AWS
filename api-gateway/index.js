const express = require("express");
const { createProxyMiddleware } = require("http-proxy-middleware");
const app = express();
const PORT = 3000;

app.use(
  "/auth",
  createProxyMiddleware({
    target: "http://auth:3005",
    changeOrigin: true,
  })
);

app.use(
  "/residentes",
  createProxyMiddleware({
    target: "http://residentes:3001",
    changeOrigin: true,
  })
);
app.use(
  "/pagos",
  createProxyMiddleware({ target: "http://pagos:3002", changeOrigin: true })
);
// app.use(
//   "/facturacion",
//   createProxyMiddleware({
//     target: "http://facturacion:3003",
//     changeOrigin: true,
//   })
// );
app.use(
  "/facturacion",
  createProxyMiddleware({
    target: "http://nginx", // apunta al servicio nginx en vez de facturacion
    changeOrigin: true,
    pathRewrite: {
      "^/facturacion": "/facturacion", // coincide con el location de nginx
    },
  })
);
app.use(
  "/notificador",
  createProxyMiddleware({
    target: "http://notificador:3004",
    changeOrigin: true,
  })
);
app.use(
  "/procesador",
  createProxyMiddleware({
    target: "http://procesador:3006",
    changeOrigin: true,
  })
);

app.get("/", (req, res) => {
  res.send("El api-gateway esta correctamente habilitado");
});

app.listen(PORT, () => console.log(`El puerte del api-gateway es el: ${PORT}`));

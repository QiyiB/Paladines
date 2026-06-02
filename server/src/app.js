import express from "express";
import helmet from "helmet";
import cors from "cors";
import { config } from "./config.js";
import { pool } from "./db.js";
import { authRouter } from "./routes/auth.routes.js";
import { tutoresRouter } from "./routes/tutores.routes.js";
import { jugadoresRouter } from "./routes/jugadores.routes.js";
import { categoriasRouter } from "./routes/categorias.routes.js";
import { plantillasRouter } from "./routes/plantillas.routes.js";
import { sesionesRouter } from "./routes/sesiones.routes.js";
import { conceptosRouter } from "./routes/conceptos.routes.js";
import { pagosRouter } from "./routes/pagos.routes.js";
import { deudoresRouter } from "./routes/deudores.routes.js";
import { usuariosRouter } from "./routes/usuarios.routes.js";
import { jobsRouter } from "./routes/jobs.routes.js";
import { errorHandler, notFound } from "./middleware/error.js";

// Crea y configura la app de Express. No hace listen: asi sirve tanto para
// arrancar local (server/src/index.js) como para una funcion serverless en
// Vercel (api/index.js), que solo exporta este handler.
const app = express();

app.use(helmet());
app.use(cors({ origin: config.clientOrigin, credentials: true }));
app.use(express.json());

// Healthcheck: confirma que el servidor responde y que la BD esta accesible.
app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({ ok: true, db: "conectada" });
  } catch {
    res.status(503).json({ ok: false, db: "sin conexion" });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/tutores", tutoresRouter);
app.use("/api/jugadores", jugadoresRouter);
app.use("/api/categorias", categoriasRouter);
app.use("/api/plantillas", plantillasRouter);
app.use("/api/sesiones", sesionesRouter);
app.use("/api/conceptos", conceptosRouter);
app.use("/api/pagos", pagosRouter);
app.use("/api/deudores", deudoresRouter);
app.use("/api/usuarios", usuariosRouter);
app.use("/api/jobs", jobsRouter);

app.use(notFound);
app.use(errorHandler);

export default app;

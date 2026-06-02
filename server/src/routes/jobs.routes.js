import { Router } from "express";
import { generarDeudasPorVencimiento } from "../jobs/generarDeudas.js";

export const jobsRouter = Router();

// GET /api/jobs/generar-deudas
// Endpoint que dispara el job de "deudas por vencimiento". Pensado para Vercel
// Cron: cuando defines la variable CRON_SECRET, Vercel envia el header
//   Authorization: Bearer <CRON_SECRET>
// en cada ejecucion programada. Aqui exigimos ese secreto para que nadie mas
// pueda dispararlo desde afuera.
jobsRouter.get("/generar-deudas", async (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.authorization || "";
    if (auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "No autorizado" });
    }
  }
  try {
    const creadas = await generarDeudasPorVencimiento();
    res.json({ ok: true, creadas, ejecutado: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

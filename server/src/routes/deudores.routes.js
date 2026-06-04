import { Router } from "express";
import { query } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

export const deudoresRouter = Router();

deudoresRouter.use(authRequired, requireRole("ADMIN"));

// GET /api/deudores?q=&documento=
// Devuelve el detalle de deudas vencidas/exigibles (vista vw_deudores),
// agrupado por jugador para mostrar "todo lo que debe".
deudoresRouter.get("/", async (req, res, next) => {
  try {
    // Pone al dia las deudas por vencimiento antes de listar (idempotente):
    // asi un jugador vuelve a aparecer en mora apenas vence su pago, sin depender
    // de esperar al job/cron diario.
    await query("SELECT generar_deudas_por_vencimiento()");

    const { q, documento } = req.query;
    const where = [];
    const params = [];
    if (documento) {
      params.push(`%${documento}%`);
      where.push(`numero_documento ILIKE $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(nombre || ' ' || apellido) ILIKE $${params.length}`);
    }
    const { rows } = await query(
      `SELECT jugador_id, tipo_documento, numero_documento, nombre, apellido,
              concepto, monto, fecha_generada, fecha_vencimiento
       FROM vw_deudores
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY apellido, nombre, fecha_generada`,
      params
    );

    // Agrupar por jugador
    const mapa = new Map();
    for (const r of rows) {
      if (!mapa.has(r.jugador_id)) {
        mapa.set(r.jugador_id, {
          jugador_id: r.jugador_id,
          tipo_documento: r.tipo_documento,
          numero_documento: r.numero_documento,
          nombre: r.nombre,
          apellido: r.apellido,
          total: 0,
          deudas: [],
        });
      }
      const g = mapa.get(r.jugador_id);
      g.total += Number(r.monto);
      g.deudas.push({ concepto: r.concepto, monto: r.monto, fecha_generada: r.fecha_generada, fecha_vencimiento: r.fecha_vencimiento });
    }
    res.json([...mapa.values()]);
  } catch (err) {
    next(err);
  }
});

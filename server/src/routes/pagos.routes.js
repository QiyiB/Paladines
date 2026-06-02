import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

export const pagosRouter = Router();

// Modulo financiero: SOLO ADMIN (validado en el servidor, no solo en la UI).
pagosRouter.use(authRequired, requireRole("ADMIN"));

const METODOS = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "NEQUI", "DAVIPLATA", "PSE", "OTRO"];

// GET /api/pagos/ingresos-mensuales  -> usa la vista vw_ingresos_mensuales
pagosRouter.get("/ingresos-mensuales", async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT to_char(mes,'YYYY-MM') AS mes, total FROM vw_ingresos_mensuales ORDER BY mes"
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/pagos/ingresos-mes  -> total del MES ACTUAL segun el reloj de la BD.
// Calcular "el mes actual" en la BD (no en el navegador) evita falsos ceros por
// diferencias de fecha/zona horaria entre cliente y servidor.
pagosRouter.get("/ingresos-mes", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT COALESCE(SUM(monto), 0)::numeric AS total
       FROM pago
       WHERE anulado = FALSE
         AND date_trunc('month', fecha_pago) = date_trunc('month', CURRENT_DATE)`
    );
    res.json({ total: Number(rows[0].total) });
  } catch (err) {
    next(err);
  }
});

// GET /api/pagos?q=&documento=&desde=&hasta=&incluir_anulados=
pagosRouter.get("/", async (req, res, next) => {
  try {
    const { q, documento, desde, hasta, incluir_anulados } = req.query;
    const where = [];
    const params = [];
    if (incluir_anulados !== "true") where.push("pg.anulado = FALSE");
    if (documento) {
      params.push(`%${documento}%`);
      where.push(`j.numero_documento ILIKE $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(j.nombre || ' ' || j.apellido) ILIKE $${params.length}`);
    }
    if (desde) {
      params.push(desde);
      where.push(`pg.fecha_pago >= $${params.length}`);
    }
    if (hasta) {
      params.push(hasta);
      where.push(`pg.fecha_pago <= $${params.length}`);
    }
    const { rows } = await query(
      `SELECT pg.id, pg.metodo, pg.monto, pg.fecha_pago, pg.fecha_expiracion, pg.anulado,
              pg.jugador_id, j.nombre AS jugador_nombre, j.apellido AS jugador_apellido,
              j.numero_documento, cp.nombre AS concepto, u.nombre AS registrado_por
       FROM pago pg
       JOIN jugador j ON j.id = pg.jugador_id
       JOIN concepto_pago cp ON cp.id = pg.concepto_id
       LEFT JOIN usuario u ON u.id = pg.registrado_por
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY pg.fecha_pago DESC, pg.id DESC
       LIMIT 300`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/pagos  { jugador_id, concepto_id, metodo, fecha_pago?, monto? }
// El monto se autocompleta del concepto y la fecha_expiracion la calcula el
// trigger preparar_pago. El trigger saldar_deuda_con_pago salda la deuda
// pendiente mas antigua de ese concepto. Aqui solo insertamos y auditamos.
pagosRouter.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.jugador_id || !b.concepto_id || !b.metodo) {
      return res.status(400).json({ error: "jugador_id, concepto_id y metodo son obligatorios" });
    }
    if (!METODOS.includes(b.metodo)) return res.status(400).json({ error: "metodo de pago invalido" });

    const monto = b.monto === "" || b.monto == null ? null : Number(b.monto);
    const { rows } = await query(
      `INSERT INTO pago (jugador_id, concepto_id, metodo, monto, fecha_pago, registrado_por)
       VALUES ($1, $2, $3::metodo_pago, $4, COALESCE($5::date, CURRENT_DATE), $6)
       RETURNING *`,
      [b.jugador_id, b.concepto_id, b.metodo, monto, b.fecha_pago || null, req.user.id]
    );
    await query(
      "INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id, detalle) VALUES ($1,'CREAR','pago',$2,$3)",
      [req.user.id, rows[0].id, JSON.stringify({ jugador_id: b.jugador_id, concepto_id: b.concepto_id, monto: rows[0].monto })]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/pagos/:id/anular  -> no se borra; se marca anulado y se reabre la
// deuda que habia saldado (vuelve a PENDIENTE).
pagosRouter.post("/:id/anular", async (req, res, next) => {
  try {
    const resultado = await withTransaction(async (client) => {
      const upd = await client.query(
        "UPDATE pago SET anulado = TRUE WHERE id = $1 AND anulado = FALSE RETURNING id",
        [req.params.id]
      );
      if (!upd.rows[0]) {
        const e = new Error("Pago no encontrado o ya anulado");
        e.status = 404;
        throw e;
      }
      await client.query(
        "UPDATE deuda SET estado = 'PENDIENTE', pago_id = NULL WHERE pago_id = $1 AND estado = 'PAGADA'",
        [req.params.id]
      );
      await client.query(
        "INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id) VALUES ($1,'ANULAR','pago',$2)",
        [req.user.id, req.params.id]
      );
      return true;
    });
    res.json({ ok: resultado });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

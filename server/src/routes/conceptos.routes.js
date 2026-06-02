import { Router } from "express";
import { query } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

export const conceptosRouter = Router();

// Todo el modulo financiero es exclusivo de ADMIN.
conceptosRouter.use(authRequired, requireRole("ADMIN"));

// GET /api/conceptos?activo=true
conceptosRouter.get("/", async (req, res, next) => {
  try {
    const { activo } = req.query;
    const where = [];
    if (activo === undefined || activo === "true") where.push("activo = TRUE");
    else if (activo === "false") where.push("activo = FALSE");
    const { rows } = await query(
      `SELECT id, nombre, monto, vigencia_dias, es_inscripcion, activo
       FROM concepto_pago ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY es_inscripcion DESC, nombre`
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

function validar(b) {
  const errores = [];
  if (!b.nombre) errores.push("nombre es obligatorio");
  if (b.monto == null || Number(b.monto) < 0) errores.push("monto invalido");
  if (b.vigencia_dias !== null && b.vigencia_dias !== undefined && b.vigencia_dias !== "" && Number(b.vigencia_dias) <= 0) {
    errores.push("vigencia_dias debe ser mayor que 0 o vacio");
  }
  return errores;
}
function vigencia(b) {
  return b.vigencia_dias === "" || b.vigencia_dias == null ? null : Number(b.vigencia_dias);
}

// POST /api/conceptos
conceptosRouter.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    const errores = validar(b);
    if (errores.length) return res.status(400).json({ error: errores.join(", ") });
    const { rows } = await query(
      `INSERT INTO concepto_pago (nombre, monto, vigencia_dias, es_inscripcion)
       VALUES ($1, $2, $3, COALESCE($4, FALSE)) RETURNING *`,
      [b.nombre, Number(b.monto), vigencia(b), !!b.es_inscripcion]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/conceptos/:id
conceptosRouter.put("/:id", async (req, res, next) => {
  try {
    const b = req.body || {};
    const errores = validar(b);
    if (errores.length) return res.status(400).json({ error: errores.join(", ") });
    const { rows } = await query(
      `UPDATE concepto_pago SET nombre = $1, monto = $2, vigencia_dias = $3, es_inscripcion = COALESCE($4, FALSE)
       WHERE id = $5 RETURNING *`,
      [b.nombre, Number(b.monto), vigencia(b), !!b.es_inscripcion, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Concepto no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/conceptos/:id  -> borrado logico
conceptosRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE concepto_pago SET activo = FALSE WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Concepto no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

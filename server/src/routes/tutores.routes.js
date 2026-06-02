import { Router } from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";

export const tutoresRouter = Router();

// Todas las rutas de tutores requieren autenticacion (Admin o Profesor).
tutoresRouter.use(authRequired);

const TIPOS_DOC = ["CC", "TI", "RC", "CE", "PAS"];

// GET /api/tutores?q=texto&documento=123&activo=true
// Busqueda por documento y/o nombre (requisito del modulo de tutores).
tutoresRouter.get("/", async (req, res, next) => {
  try {
    const { q, documento, activo } = req.query;
    const where = [];
    const params = [];

    if (activo === undefined || activo === "true") {
      where.push("activo = TRUE");
    } else if (activo === "false") {
      where.push("activo = FALSE");
    }
    if (documento) {
      params.push(`%${documento}%`);
      where.push(`numero_documento ILIKE $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(nombre || ' ' || apellido) ILIKE $${params.length}`);
    }

    const sql = `
      SELECT id, tipo_documento, numero_documento, nombre, apellido,
             telefono, email, direccion, activo, created_at
      FROM tutor
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY apellido, nombre
      LIMIT 200`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/tutores/:id
tutoresRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT * FROM tutor WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Tutor no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

function validarTutor(body) {
  const errores = [];
  if (!body.numero_documento) errores.push("numero_documento es obligatorio");
  if (!body.nombre) errores.push("nombre es obligatorio");
  if (!body.apellido) errores.push("apellido es obligatorio");
  if (body.tipo_documento && !TIPOS_DOC.includes(body.tipo_documento)) {
    errores.push("tipo_documento invalido");
  }
  return errores;
}

// POST /api/tutores
tutoresRouter.post("/", async (req, res, next) => {
  try {
    const errores = validarTutor(req.body || {});
    if (errores.length) return res.status(400).json({ error: errores.join(", ") });

    const b = req.body;
    const { rows } = await query(
      `INSERT INTO tutor (tipo_documento, numero_documento, nombre, apellido, telefono, email, direccion, creado_por)
       VALUES (COALESCE($1,'CC')::tipo_documento, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [b.tipo_documento, b.numero_documento, b.nombre, b.apellido, b.telefono || null, b.email || null, b.direccion || null, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tutores/:id
tutoresRouter.put("/:id", async (req, res, next) => {
  try {
    const errores = validarTutor(req.body || {});
    if (errores.length) return res.status(400).json({ error: errores.join(", ") });

    const b = req.body;
    const { rows } = await query(
      `UPDATE tutor SET tipo_documento = COALESCE($1,'CC')::tipo_documento, numero_documento = $2, nombre = $3,
              apellido = $4, telefono = $5, email = $6, direccion = $7
       WHERE id = $8 RETURNING *`,
      [b.tipo_documento, b.numero_documento, b.nombre, b.apellido, b.telefono || null, b.email || null, b.direccion || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Tutor no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tutores/:id  -> borrado logico (activo = FALSE)
tutoresRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE tutor SET activo = FALSE WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Tutor no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

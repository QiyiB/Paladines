import { Router } from "express";
import { query } from "../db.js";
import { authRequired } from "../middleware/auth.js";

export const categoriasRouter = Router();

categoriasRouter.use(authRequired);

// GET /api/categorias?q=texto&activo=true
categoriasRouter.get("/", async (req, res, next) => {
  try {
    const { q, activo } = req.query;
    const where = [];
    const params = [];
    if (activo === undefined || activo === "true") where.push("activo = TRUE");
    else if (activo === "false") where.push("activo = FALSE");
    if (q) {
      params.push(`%${q}%`);
      where.push(`nombre ILIKE $${params.length}`);
    }
    const { rows } = await query(
      `SELECT id, nombre, anio_min, anio_max, activo, created_at
       FROM categoria ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY anio_min DESC, nombre`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

function validar(body) {
  const errores = [];
  const min = Number(body.anio_min);
  const max = Number(body.anio_max);
  if (!body.nombre) errores.push("nombre es obligatorio");
  if (!Number.isInteger(min) || min < 1990 || min > 2035) errores.push("anio_min invalido");
  if (!Number.isInteger(max) || max < 1990 || max > 2035) errores.push("anio_max invalido");
  if (Number.isInteger(min) && Number.isInteger(max) && min > max) errores.push("anio_min no puede ser mayor que anio_max");
  return errores;
}

// POST /api/categorias
categoriasRouter.post("/", async (req, res, next) => {
  try {
    const errores = validar(req.body || {});
    if (errores.length) return res.status(400).json({ error: errores.join(", ") });
    const b = req.body;
    const { rows } = await query(
      "INSERT INTO categoria (nombre, anio_min, anio_max) VALUES ($1, $2, $3) RETURNING *",
      [b.nombre, Number(b.anio_min), Number(b.anio_max)]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/categorias/:id
categoriasRouter.put("/:id", async (req, res, next) => {
  try {
    const errores = validar(req.body || {});
    if (errores.length) return res.status(400).json({ error: errores.join(", ") });
    const b = req.body;
    const { rows } = await query(
      "UPDATE categoria SET nombre = $1, anio_min = $2, anio_max = $3 WHERE id = $4 RETURNING *",
      [b.nombre, Number(b.anio_min), Number(b.anio_max), req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Categoria no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/categorias/:id  -> borrado logico
categoriasRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE categoria SET activo = FALSE WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Categoria no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

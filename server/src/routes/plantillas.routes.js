import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { authRequired } from "../middleware/auth.js";
import { generarPosiciones, parseFormacion } from "../lib/formacion.js";

export const plantillasRouter = Router();

plantillasRouter.use(authRequired);

// GET /api/plantillas?categoria_id=&q=
plantillasRouter.get("/", async (req, res, next) => {
  try {
    const { categoria_id, q } = req.query;
    const where = ["p.activo"];
    const params = [];
    if (categoria_id) {
      params.push(categoria_id);
      where.push(`p.categoria_id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`p.nombre ILIKE $${params.length}`);
    }
    const { rows } = await query(
      `SELECT p.id, p.nombre, p.formacion, p.categoria_id, c.nombre AS categoria_nombre,
              c.anio_min, c.anio_max, p.created_at,
              (SELECT COUNT(*) FROM plantilla_posicion pp
                WHERE pp.plantilla_id = p.id AND pp.jugador_id IS NOT NULL) AS asignados
       FROM plantilla p
       JOIN categoria c ON c.id = p.categoria_id
       WHERE ${where.join(" AND ")}
       ORDER BY p.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/plantillas/:id  -> detalle con posiciones y cuerpo tecnico
plantillasRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT p.*, c.nombre AS categoria_nombre, c.anio_min, c.anio_max
       FROM plantilla p JOIN categoria c ON c.id = p.categoria_id WHERE p.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Plantilla no encontrada" });

    const posiciones = await query(
      `SELECT pp.id, pp.posicion, pp.tipo, pp.orden, pp.coord_x, pp.coord_y, pp.jugador_id,
              j.nombre, j.apellido, j.numero_documento, j.foto_url
       FROM plantilla_posicion pp
       LEFT JOIN jugador j ON j.id = pp.jugador_id
       WHERE pp.plantilla_id = $1
       ORDER BY pp.tipo, pp.orden`,
      [req.params.id]
    );

    const cuerpo = await query(
      `SELECT ct.id, ct.rol_tecnico, ct.usuario_id, u.nombre, u.rol
       FROM plantilla_cuerpo_tecnico ct JOIN usuario u ON u.id = ct.usuario_id
       WHERE ct.plantilla_id = $1 ORDER BY ct.rol_tecnico`,
      [req.params.id]
    );

    res.json({ ...rows[0], posiciones: posiciones.rows, cuerpo_tecnico: cuerpo.rows });
  } catch (err) {
    next(err);
  }
});

// GET /api/plantillas/:id/elegibles
// Jugadores elegibles: activos, con anio de nacimiento dentro del rango de la
// categoria, SIN mora, y que no esten ya asignados en esta plantilla.
plantillasRouter.get("/:id/elegibles", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT j.id, j.nombre, j.apellido, j.numero_documento, j.foto_url,
              date_part('year', j.fecha_nacimiento)::int AS anio_nacimiento,
              date_part('year', age(j.fecha_nacimiento))::int AS edad
       FROM jugador j
       JOIN plantilla p ON p.id = $1
       JOIN categoria c ON c.id = p.categoria_id
       WHERE j.activo
         AND date_part('year', j.fecha_nacimiento) BETWEEN c.anio_min AND c.anio_max
         AND NOT EXISTS (SELECT 1 FROM vw_jugador_en_mora m WHERE m.jugador_id = j.id)
         AND NOT EXISTS (SELECT 1 FROM plantilla_posicion pp
                          WHERE pp.plantilla_id = $1 AND pp.jugador_id = j.id)
       ORDER BY j.apellido, j.nombre`,
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// POST /api/plantillas  { nombre, categoria_id, formacion }
plantillasRouter.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.nombre || !b.categoria_id || !b.formacion) {
      return res.status(400).json({ error: "nombre, categoria_id y formacion son obligatorios" });
    }
    const posiciones = generarPosiciones(b.formacion);
    if (!posiciones) {
      return res.status(400).json({ error: "Formacion invalida. Las lineas deben sumar 10 (ej. 4-3-3, 4-4-2)" });
    }

    const creada = await withTransaction(async (client) => {
      const pl = await client.query(
        "INSERT INTO plantilla (nombre, categoria_id, formacion, creado_por) VALUES ($1, $2, $3, $4) RETURNING *",
        [b.nombre, b.categoria_id, b.formacion, req.user.id]
      );
      const plantilla = pl.rows[0];
      for (const p of posiciones) {
        await client.query(
          `INSERT INTO plantilla_posicion (plantilla_id, posicion, tipo, orden, coord_x, coord_y)
           VALUES ($1, $2, $3::tipo_posicion, $4, $5, $6)`,
          [plantilla.id, p.posicion, p.tipo, p.orden, p.coord_x, p.coord_y]
        );
      }
      return plantilla;
    });
    res.status(201).json(creada);
  } catch (err) {
    next(err);
  }
});

// PUT /api/plantillas/:id  -> renombrar / cambiar categoria (no toca posiciones)
plantillasRouter.put("/:id", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.nombre || !b.categoria_id) {
      return res.status(400).json({ error: "nombre y categoria_id son obligatorios" });
    }
    const { rows } = await query(
      "UPDATE plantilla SET nombre = $1, categoria_id = $2 WHERE id = $3 RETURNING *",
      [b.nombre, b.categoria_id, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Plantilla no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/plantillas/:id/formacion  { formacion }
// Regenera las casillas de la cancha (esto vacia las asignaciones previas).
plantillasRouter.put("/:id/formacion", async (req, res, next) => {
  try {
    const formacion = (req.body || {}).formacion;
    const posiciones = generarPosiciones(formacion);
    if (!posiciones) {
      return res.status(400).json({ error: "Formacion invalida. Las lineas deben sumar 10 (ej. 4-3-3)" });
    }
    await withTransaction(async (client) => {
      const upd = await client.query(
        "UPDATE plantilla SET formacion = $1 WHERE id = $2 RETURNING id",
        [formacion, req.params.id]
      );
      if (!upd.rows[0]) {
        const e = new Error("Plantilla no encontrada");
        e.status = 404;
        throw e;
      }
      await client.query("DELETE FROM plantilla_posicion WHERE plantilla_id = $1", [req.params.id]);
      for (const p of posiciones) {
        await client.query(
          `INSERT INTO plantilla_posicion (plantilla_id, posicion, tipo, orden, coord_x, coord_y)
           VALUES ($1, $2, $3::tipo_posicion, $4, $5, $6)`,
          [req.params.id, p.posicion, p.tipo, p.orden, p.coord_x, p.coord_y]
        );
      }
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// PUT /api/plantillas/:id/posiciones/:posId  { jugador_id }  (null = liberar)
plantillasRouter.put("/:id/posiciones/:posId", async (req, res, next) => {
  try {
    const jugadorId = (req.body || {}).jugador_id ?? null;

    // Si se asigna un jugador, validar elegibilidad (rango de anios + sin mora).
    if (jugadorId !== null) {
      const eleg = await query(
        `SELECT 1
         FROM jugador j
         JOIN plantilla p ON p.id = $1
         JOIN categoria c ON c.id = p.categoria_id
         WHERE j.id = $2 AND j.activo
           AND date_part('year', j.fecha_nacimiento) BETWEEN c.anio_min AND c.anio_max
           AND NOT EXISTS (SELECT 1 FROM vw_jugador_en_mora m WHERE m.jugador_id = j.id)`,
        [req.params.id, jugadorId]
      );
      if (!eleg.rows[0]) {
        return res.status(400).json({ error: "El jugador no es elegible (fuera de categoria o en mora)" });
      }
    }

    const { rows } = await query(
      "UPDATE plantilla_posicion SET jugador_id = $1 WHERE id = $2 AND plantilla_id = $3 RETURNING id",
      [jugadorId, req.params.posId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Posicion no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/plantillas/:id/cuerpo-tecnico  { usuario_id, rol_tecnico }
plantillasRouter.post("/:id/cuerpo-tecnico", async (req, res, next) => {
  try {
    const { usuario_id, rol_tecnico } = req.body || {};
    if (!usuario_id) return res.status(400).json({ error: "usuario_id es obligatorio" });
    await query(
      `INSERT INTO plantilla_cuerpo_tecnico (plantilla_id, usuario_id, rol_tecnico)
       VALUES ($1, $2, COALESCE($3, 'DT'))`,
      [req.params.id, usuario_id, rol_tecnico || null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/plantillas/:id/cuerpo-tecnico/:usuarioId
plantillasRouter.delete("/:id/cuerpo-tecnico/:usuarioId", async (req, res, next) => {
  try {
    await query(
      "DELETE FROM plantilla_cuerpo_tecnico WHERE plantilla_id = $1 AND usuario_id = $2",
      [req.params.id, req.params.usuarioId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/plantillas/:id  -> borrado logico
plantillasRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE plantilla SET activo = FALSE WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Plantilla no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

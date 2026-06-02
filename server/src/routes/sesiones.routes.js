import { Router } from "express";
import { query, withTransaction } from "../db.js";
import { authRequired } from "../middleware/auth.js";

export const sesionesRouter = Router();

sesionesRouter.use(authRequired);

const TIPOS = ["ENTRENAMIENTO", "AMISTOSO", "TORNEO"];

// GET /api/sesiones?plantilla_id=&tipo=
sesionesRouter.get("/", async (req, res, next) => {
  try {
    const { plantilla_id, tipo } = req.query;
    const where = [];
    const params = [];
    if (plantilla_id) {
      params.push(plantilla_id);
      where.push(`s.plantilla_id = $${params.length}`);
    }
    if (tipo && TIPOS.includes(tipo)) {
      params.push(tipo);
      where.push(`s.tipo = $${params.length}::tipo_sesion`);
    }
    const { rows } = await query(
      `SELECT s.id, s.tipo, s.descripcion, s.fecha, s.rival,
              s.marcador_local, s.marcador_visitante, s.plantilla_id,
              p.nombre AS plantilla_nombre,
              (SELECT COUNT(*) FROM asistencia a WHERE a.sesion_id = s.id) AS total,
              (SELECT COUNT(*) FROM asistencia a WHERE a.sesion_id = s.id AND a.asistio) AS presentes
       FROM sesion s
       JOIN plantilla p ON p.id = s.plantilla_id
       ${where.length ? "WHERE " + where.join(" AND ") : ""}
       ORDER BY s.fecha DESC
       LIMIT 200`,
      params
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/sesiones/:id  -> detalle + lista de asistencia
sesionesRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT s.*, p.nombre AS plantilla_nombre
       FROM sesion s JOIN plantilla p ON p.id = s.plantilla_id WHERE s.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Sesion no encontrada" });

    const asistencia = await query(
      `SELECT a.id, a.jugador_id, a.asistio, a.motivo,
              j.nombre, j.apellido, j.numero_documento
       FROM asistencia a JOIN jugador j ON j.id = a.jugador_id
       WHERE a.sesion_id = $1 ORDER BY j.apellido, j.nombre`,
      [req.params.id]
    );
    res.json({ ...rows[0], asistencia: asistencia.rows });
  } catch (err) {
    next(err);
  }
});

function normalizarResultado(b) {
  // En entrenamiento no hay rival ni marcador (lo exige el CHECK de la BD).
  if (b.tipo === "ENTRENAMIENTO") {
    return { rival: null, marcador_local: null, marcador_visitante: null };
  }
  return {
    rival: b.rival || null,
    marcador_local: b.marcador_local === "" || b.marcador_local == null ? null : Number(b.marcador_local),
    marcador_visitante: b.marcador_visitante === "" || b.marcador_visitante == null ? null : Number(b.marcador_visitante),
  };
}

// POST /api/sesiones
// Crea la sesion y, en la misma transaccion, genera las filas de asistencia
// a partir de los jugadores actualmente asignados a la plantilla.
sesionesRouter.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.tipo || !TIPOS.includes(b.tipo)) return res.status(400).json({ error: "tipo invalido" });
    if (!b.plantilla_id) return res.status(400).json({ error: "plantilla_id es obligatorio" });
    if (!b.fecha) return res.status(400).json({ error: "fecha es obligatoria" });
    const r = normalizarResultado(b);

    const creada = await withTransaction(async (client) => {
      const ins = await client.query(
        `INSERT INTO sesion (tipo, descripcion, plantilla_id, fecha, rival, marcador_local, marcador_visitante, creado_por)
         VALUES ($1::tipo_sesion, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
        [b.tipo, b.descripcion || null, b.plantilla_id, b.fecha, r.rival, r.marcador_local, r.marcador_visitante, req.user.id]
      );
      const sesion = ins.rows[0];
      await client.query(
        `INSERT INTO asistencia (sesion_id, jugador_id)
         SELECT $1, q.jugador_id
         FROM (SELECT DISTINCT jugador_id FROM plantilla_posicion
                WHERE plantilla_id = $2 AND jugador_id IS NOT NULL) q`,
        [sesion.id, b.plantilla_id]
      );
      return sesion;
    });
    res.status(201).json(creada);
  } catch (err) {
    next(err);
  }
});

// PUT /api/sesiones/:id  -> editar datos / resultado
sesionesRouter.put("/:id", async (req, res, next) => {
  try {
    const b = req.body || {};
    if (!b.tipo || !TIPOS.includes(b.tipo)) return res.status(400).json({ error: "tipo invalido" });
    if (!b.fecha) return res.status(400).json({ error: "fecha es obligatoria" });
    const r = normalizarResultado(b);

    const { rows } = await query(
      `UPDATE sesion SET tipo = $1::tipo_sesion, descripcion = $2, fecha = $3,
              rival = $4, marcador_local = $5, marcador_visitante = $6
       WHERE id = $7 RETURNING *`,
      [b.tipo, b.descripcion || null, b.fecha, r.rival, r.marcador_local, r.marcador_visitante, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Sesion no encontrada" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/sesiones/:id/asistencia  { asistencias: [{ jugador_id, asistio, motivo }] }
sesionesRouter.put("/:id/asistencia", async (req, res, next) => {
  try {
    const lista = Array.isArray((req.body || {}).asistencias) ? req.body.asistencias : [];
    await withTransaction(async (client) => {
      for (const a of lista) {
        await client.query(
          `INSERT INTO asistencia (sesion_id, jugador_id, asistio, motivo)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (sesion_id, jugador_id)
           DO UPDATE SET asistio = EXCLUDED.asistio, motivo = EXCLUDED.motivo`,
          [req.params.id, a.jugador_id, !!a.asistio, a.motivo || null]
        );
      }
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/sesiones/:id/sincronizar  -> agrega a la asistencia los jugadores
// del plantel que aun no esten (por si la plantilla cambio tras crear la sesion).
sesionesRouter.post("/:id/sincronizar", async (req, res, next) => {
  try {
    const { rows } = await query(
      `INSERT INTO asistencia (sesion_id, jugador_id)
       SELECT s.id, q.jugador_id
       FROM sesion s
       JOIN (SELECT DISTINCT pp.jugador_id, pp.plantilla_id FROM plantilla_posicion pp
              WHERE pp.jugador_id IS NOT NULL) q ON q.plantilla_id = s.plantilla_id
       WHERE s.id = $1
         AND NOT EXISTS (SELECT 1 FROM asistencia a WHERE a.sesion_id = s.id AND a.jugador_id = q.jugador_id)
       RETURNING id`,
      [req.params.id]
    );
    res.json({ ok: true, agregados: rows.length });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sesiones/:id  (elimina la sesion y su asistencia en cascada)
sesionesRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await query("DELETE FROM sesion WHERE id = $1 RETURNING id", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Sesion no encontrada" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

import { Router } from "express";
import multer from "multer";
import { put, del } from "@vercel/blob";
import { query, withTransaction } from "../db.js";
import { authRequired } from "../middleware/auth.js";

export const jugadoresRouter = Router();

jugadoresRouter.use(authRequired);

// Subida de fotos en memoria (en serverless no hay disco persistente). Limite 4 MB.
const subirFoto = multer({ storage: multer.memoryStorage(), limits: { fileSize: 4 * 1024 * 1024 } });

const TIPOS_DOC = ["CC", "TI", "RC", "CE", "PAS"];

// GET /api/jugadores?q=texto&documento=123&activo=true
jugadoresRouter.get("/", async (req, res, next) => {
  try {
    const { q, documento, activo } = req.query;
    const where = [];
    const params = [];

    if (activo === undefined || activo === "true") where.push("j.activo = TRUE");
    else if (activo === "false") where.push("j.activo = FALSE");

    if (documento) {
      params.push(`%${documento}%`);
      where.push(`j.numero_documento ILIKE $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(j.nombre || ' ' || j.apellido) ILIKE $${params.length}`);
    }

    const sql = `
      SELECT j.id, j.tipo_documento, j.numero_documento, j.nombre, j.apellido,
             j.fecha_nacimiento, j.genero, j.activo, j.foto_url,
             date_part('year', age(j.fecha_nacimiento))::int AS edad,
             (m.jugador_id IS NOT NULL) AS en_mora
      FROM jugador j
      LEFT JOIN vw_jugador_en_mora m ON m.jugador_id = j.id
      ${where.length ? "WHERE " + where.join(" AND ") : ""}
      ORDER BY j.apellido, j.nombre
      LIMIT 200`;
    const { rows } = await query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/jugadores/:id  -> incluye tutores y estado de mora
jugadoresRouter.get("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT j.*, date_part('year', age(j.fecha_nacimiento))::int AS edad,
              (m.jugador_id IS NOT NULL) AS en_mora
       FROM jugador j
       LEFT JOIN vw_jugador_en_mora m ON m.jugador_id = j.id
       WHERE j.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Jugador no encontrado" });

    const tutores = await query(
      `SELECT jt.id AS vinculo_id, jt.parentesco, jt.es_principal,
              t.id AS tutor_id, t.nombre, t.apellido, t.tipo_documento,
              t.numero_documento, t.telefono, t.email
       FROM jugador_tutor jt
       JOIN tutor t ON t.id = jt.tutor_id
       WHERE jt.jugador_id = $1
       ORDER BY jt.es_principal DESC, t.apellido`,
      [req.params.id]
    );

    res.json({ ...rows[0], tutores: tutores.rows });
  } catch (err) {
    next(err);
  }
});

function validarJugador(body) {
  const errores = [];
  if (!body.numero_documento) errores.push("numero_documento es obligatorio");
  if (!body.nombre) errores.push("nombre es obligatorio");
  if (!body.apellido) errores.push("apellido es obligatorio");
  if (!body.fecha_nacimiento) errores.push("fecha_nacimiento es obligatoria");
  if (body.tipo_documento && !TIPOS_DOC.includes(body.tipo_documento)) errores.push("tipo_documento invalido");
  if (body.genero && !["M", "F", "O"].includes(body.genero)) errores.push("genero invalido");
  return errores;
}

// POST /api/jugadores
// Crea el jugador Y sus tutores en UNA sola transaccion. El trigger
// trg_jugador_min_tutor (DEFERRABLE INITIALLY DEFERRED) verifica al COMMIT
// que el jugador tenga al menos un tutor; si no, la transaccion se revierte.
jugadoresRouter.post("/", async (req, res, next) => {
  try {
    const b = req.body || {};
    const errores = validarJugador(b);
    const tutores = Array.isArray(b.tutores) ? b.tutores : [];
    if (tutores.length === 0) errores.push("Debes asignar al menos un tutor");

    const principales = tutores.filter((t) => t.es_principal).length;
    if (tutores.length > 0 && principales !== 1) {
      errores.push("Debe haber exactamente un tutor principal");
    }
    if (errores.length) return res.status(400).json({ error: errores.join(", ") });

    const creado = await withTransaction(async (client) => {
      const jugRes = await client.query(
        `INSERT INTO jugador (tipo_documento, numero_documento, nombre, apellido, fecha_nacimiento,
                              genero, eps, contacto_emergencia, telefono_emergencia, observaciones_medicas, creado_por)
         VALUES (COALESCE($1,'TI')::tipo_documento, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         RETURNING *`,
        [b.tipo_documento, b.numero_documento, b.nombre, b.apellido, b.fecha_nacimiento,
         b.genero || null, b.eps || null, b.contacto_emergencia || null,
         b.telefono_emergencia || null, b.observaciones_medicas || null, req.user.id]
      );
      const jugador = jugRes.rows[0];

      for (const t of tutores) {
        await client.query(
          `INSERT INTO jugador_tutor (jugador_id, tutor_id, parentesco, es_principal)
           VALUES ($1, $2, $3, $4)`,
          [jugador.id, t.tutor_id, t.parentesco || null, !!t.es_principal]
        );
      }
      return jugador;
    });

    res.status(201).json(creado);
  } catch (err) {
    next(err);
  }
});

// PUT /api/jugadores/:id  -> actualiza datos del jugador (no los tutores)
jugadoresRouter.put("/:id", async (req, res, next) => {
  try {
    const b = req.body || {};
    const errores = validarJugador(b);
    if (errores.length) return res.status(400).json({ error: errores.join(", ") });

    const { rows } = await query(
      `UPDATE jugador SET tipo_documento = COALESCE($1,'TI')::tipo_documento, numero_documento = $2, nombre = $3,
              apellido = $4, fecha_nacimiento = $5, genero = $6, eps = $7,
              contacto_emergencia = $8, telefono_emergencia = $9, observaciones_medicas = $10
       WHERE id = $11 RETURNING *`,
      [b.tipo_documento, b.numero_documento, b.nombre, b.apellido, b.fecha_nacimiento,
       b.genero || null, b.eps || null, b.contacto_emergencia || null,
       b.telefono_emergencia || null, b.observaciones_medicas || null, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Jugador no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/jugadores/:id  -> borrado logico
jugadoresRouter.delete("/:id", async (req, res, next) => {
  try {
    const { rows } = await query(
      "UPDATE jugador SET activo = FALSE WHERE id = $1 RETURNING id",
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Jugador no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/jugadores/:id/tutores  -> vincular un tutor existente
jugadoresRouter.post("/:id/tutores", async (req, res, next) => {
  try {
    const { tutor_id, parentesco } = req.body || {};
    if (!tutor_id) return res.status(400).json({ error: "tutor_id es obligatorio" });

    await query(
      `INSERT INTO jugador_tutor (jugador_id, tutor_id, parentesco, es_principal)
       VALUES ($1, $2, $3, FALSE)`,
      [req.params.id, tutor_id, parentesco || null]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/jugadores/:id/tutores/:tutorId  -> desvincular (no puede quedar sin tutores)
jugadoresRouter.delete("/:id/tutores/:tutorId", async (req, res, next) => {
  try {
    await withTransaction(async (client) => {
      const count = await client.query(
        "SELECT COUNT(*)::int AS n FROM jugador_tutor WHERE jugador_id = $1",
        [req.params.id]
      );
      if (count.rows[0].n <= 1) {
        const e = new Error("El jugador debe conservar al menos un tutor");
        e.status = 400;
        throw e;
      }
      await client.query(
        "DELETE FROM jugador_tutor WHERE jugador_id = $1 AND tutor_id = $2",
        [req.params.id, req.params.tutorId]
      );
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// PUT /api/jugadores/:id/tutor-principal  { tutor_id }
// Cambia el tutor principal en una transaccion: desmarca el actual y marca el nuevo.
jugadoresRouter.put("/:id/tutor-principal", async (req, res, next) => {
  try {
    const { tutor_id } = req.body || {};
    if (!tutor_id) return res.status(400).json({ error: "tutor_id es obligatorio" });

    await withTransaction(async (client) => {
      await client.query(
        "UPDATE jugador_tutor SET es_principal = FALSE WHERE jugador_id = $1 AND es_principal",
        [req.params.id]
      );
      const upd = await client.query(
        "UPDATE jugador_tutor SET es_principal = TRUE WHERE jugador_id = $1 AND tutor_id = $2 RETURNING id",
        [req.params.id, tutor_id]
      );
      if (!upd.rows[0]) {
        const e = new Error("Ese tutor no esta vinculado al jugador");
        e.status = 404;
        throw e;
      }
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

// POST /api/jugadores/:id/foto  (multipart/form-data, campo "foto")
// Sube la imagen a Vercel Blob y guarda la URL en jugador.foto_url.
jugadoresRouter.post("/:id/foto", subirFoto.single("foto"), async (req, res, next) => {
  try {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
      return res.status(503).json({ error: "Almacenamiento de fotos no configurado (falta BLOB_READ_WRITE_TOKEN)" });
    }
    if (!req.file) return res.status(400).json({ error: "No se recibio ninguna imagen (campo 'foto')" });
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "El archivo debe ser una imagen" });
    }

    const ext = (req.file.originalname.split(".").pop() || "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const blob = await put(`jugadores/${req.params.id}-${Date.now()}.${ext}`, req.file.buffer, {
      access: "public",
      contentType: req.file.mimetype,
      token: process.env.BLOB_READ_WRITE_TOKEN,
    });

    const { rows } = await query(
      "UPDATE jugador SET foto_url = $1 WHERE id = $2 RETURNING id, foto_url",
      [blob.url, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Jugador no encontrado" });
    res.json({ foto_url: blob.url });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/jugadores/:id/foto  -> quita la foto (y la borra del Blob)
jugadoresRouter.delete("/:id/foto", async (req, res, next) => {
  try {
    const { rows } = await query("SELECT foto_url FROM jugador WHERE id = $1", [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: "Jugador no encontrado" });

    await query("UPDATE jugador SET foto_url = NULL WHERE id = $1", [req.params.id]);

    if (rows[0].foto_url && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        await del(rows[0].foto_url, { token: process.env.BLOB_READ_WRITE_TOKEN });
      } catch {
        /* si falla el borrado del blob no es critico */
      }
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

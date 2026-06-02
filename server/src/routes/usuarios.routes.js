import { Router } from "express";
import bcrypt from "bcryptjs";
import { query } from "../db.js";
import { authRequired, requireRole } from "../middleware/auth.js";

export const usuariosRouter = Router();

usuariosRouter.use(authRequired);

// GET /api/usuarios
// - ADMIN: listado completo para gestionar profesores.
// - PROFESOR: solo datos basicos (para selectores, p. ej. cuerpo tecnico).
usuariosRouter.get("/", async (req, res, next) => {
  try {
    if (req.user.rol === "ADMIN") {
      const { rows } = await query(
        `SELECT id, nombre, email, rol, activo, debe_cambiar_password, ultimo_acceso, created_at
         FROM usuario ORDER BY nombre`
      );
      return res.json(rows);
    }
    const { rows } = await query("SELECT id, nombre, rol FROM usuario WHERE activo ORDER BY nombre");
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

const ROLES = ["ADMIN", "PROFESOR"];

// POST /api/usuarios  (solo ADMIN) -> crea una cuenta (sin auto-registro).
// El admin define una contrasena temporal; el usuario debera cambiarla al entrar.
usuariosRouter.post("/", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { email, nombre, rol, password } = req.body || {};
    if (!email || !nombre || !rol || !password) {
      return res.status(400).json({ error: "email, nombre, rol y password son obligatorios" });
    }
    if (!ROLES.includes(rol)) return res.status(400).json({ error: "rol invalido" });
    if (String(password).length < 8) return res.status(400).json({ error: "La contrasena temporal debe tener al menos 8 caracteres" });

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO usuario (email, password_hash, nombre, rol, debe_cambiar_password, creado_por)
       VALUES ($1, $2, $3, $4::rol_usuario, TRUE, $5)
       RETURNING id, nombre, email, rol, activo, debe_cambiar_password`,
      [email, hash, nombre, rol, req.user.id]
    );
    await query(
      "INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id) VALUES ($1,'CREAR','usuario',$2)",
      [req.user.id, rows[0].id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// PUT /api/usuarios/:id  (solo ADMIN) -> editar nombre, rol, activo.
usuariosRouter.put("/:id", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { nombre, rol, activo } = req.body || {};
    if (!nombre || !rol) return res.status(400).json({ error: "nombre y rol son obligatorios" });
    if (!ROLES.includes(rol)) return res.status(400).json({ error: "rol invalido" });

    // Evita que el admin se desactive a si mismo y se quede fuera.
    if (Number(req.params.id) === Number(req.user.id) && activo === false) {
      return res.status(400).json({ error: "No puedes desactivar tu propia cuenta" });
    }

    const { rows } = await query(
      `UPDATE usuario SET nombre = $1, rol = $2::rol_usuario, activo = COALESCE($3, activo)
       WHERE id = $4 RETURNING id, nombre, email, rol, activo, debe_cambiar_password`,
      [nombre, rol, activo, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

// POST /api/usuarios/:id/reset-password  (solo ADMIN) -> contrasena temporal nueva.
usuariosRouter.post("/:id/reset-password", requireRole("ADMIN"), async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (!password || String(password).length < 8) {
      return res.status(400).json({ error: "La nueva contrasena debe tener al menos 8 caracteres" });
    }
    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      "UPDATE usuario SET password_hash = $1, debe_cambiar_password = TRUE WHERE id = $2 RETURNING id",
      [hash, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

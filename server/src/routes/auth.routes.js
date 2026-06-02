import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { query } from "../db.js";
import { config } from "../config.js";
import { authRequired } from "../middleware/auth.js";

export const authRouter = Router();

// Limita los intentos de login para mitigar fuerza bruta.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Intenta de nuevo mas tarde." },
});

function firmarToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, rol: usuario.rol, nombre: usuario.nombre, email: usuario.email },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
}

function usuarioPublico(u) {
  return {
    id: u.id,
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    debe_cambiar_password: u.debe_cambiar_password,
  };
}

// POST /api/auth/login
authRouter.post("/login", loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email y contrasena son obligatorios" });
    }

    const { rows } = await query(
      "SELECT id, email, nombre, rol, activo, password_hash, debe_cambiar_password FROM usuario WHERE email = $1",
      [email]
    );
    const usuario = rows[0];

    // Mensaje generico para no revelar si el email existe.
    const credInvalidas = () => res.status(401).json({ error: "Credenciales invalidas" });
    if (!usuario || !usuario.activo) return credInvalidas();

    const ok = await bcrypt.compare(password, usuario.password_hash);
    if (!ok) return credInvalidas();

    await query("UPDATE usuario SET ultimo_acceso = now() WHERE id = $1", [usuario.id]);
    await query(
      "INSERT INTO auditoria (usuario_id, accion, entidad, entidad_id) VALUES ($1, 'LOGIN', 'usuario', $1)",
      [usuario.id]
    );

    res.json({ token: firmarToken(usuario), usuario: usuarioPublico(usuario) });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me  -> datos del usuario autenticado
authRouter.get("/me", authRequired, async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT id, email, nombre, rol, debe_cambiar_password FROM usuario WHERE id = $1 AND activo",
      [req.user.id]
    );
    if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ usuario: usuarioPublico(rows[0]) });
  } catch (err) {
    next(err);
  }
});

// POST /api/auth/cambiar-password  -> el usuario cambia su propia contrasena
authRouter.post("/cambiar-password", authRequired, async (req, res, next) => {
  try {
    const { password_actual, password_nueva } = req.body || {};
    if (!password_actual || !password_nueva) {
      return res.status(400).json({ error: "Debes enviar la contrasena actual y la nueva" });
    }
    if (String(password_nueva).length < 8) {
      return res.status(400).json({ error: "La nueva contrasena debe tener al menos 8 caracteres" });
    }

    const { rows } = await query("SELECT password_hash FROM usuario WHERE id = $1", [req.user.id]);
    if (!rows[0]) return res.status(404).json({ error: "Usuario no encontrado" });

    const ok = await bcrypt.compare(password_actual, rows[0].password_hash);
    if (!ok) return res.status(400).json({ error: "La contrasena actual no es correcta" });

    const hash = await bcrypt.hash(password_nueva, 12);
    await query(
      "UPDATE usuario SET password_hash = $1, debe_cambiar_password = FALSE WHERE id = $2",
      [hash, req.user.id]
    );

    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

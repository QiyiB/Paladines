import jwt from "jsonwebtoken";
import { config } from "../config.js";

// Verifica el JWT del header Authorization: Bearer <token> y adjunta el
// usuario decodificado a req.user. Rechaza con 401 si falta o es invalido.
export function authRequired(req, res, next) {
  const header = req.headers.authorization || "";
  const [scheme, token] = header.split(" ");

  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ error: "No autenticado" });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub, rol: payload.rol, nombre: payload.nombre, email: payload.email };
    next();
  } catch {
    return res.status(401).json({ error: "Token invalido o expirado" });
  }
}

// Restringe el acceso a uno o varios roles. La verificacion vive en el
// servidor: ocultar botones en la UI NO es suficiente. Ej: requireRole("ADMIN").
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: "No autenticado" });
    }
    if (!roles.includes(req.user.rol)) {
      return res.status(403).json({ error: "No tienes permisos para esta accion" });
    }
    next();
  };
}

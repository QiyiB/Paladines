// Captura errores de PostgreSQL frecuentes y los traduce a respuestas claras.
// Evita filtrar stack traces en produccion.
export function errorHandler(err, req, res, _next) {
  // Imagen demasiado grande (multer)
  if (err.code === "LIMIT_FILE_SIZE") {
    return res.status(400).json({ error: "La imagen supera el tamano maximo (4 MB)" });
  }
  // Violacion de unicidad (documento duplicado, email duplicado, etc.)
  if (err.code === "23505") {
    return res.status(409).json({ error: "Ya existe un registro con esos datos (valor duplicado)" });
  }
  // Violacion de llave foranea
  if (err.code === "23503") {
    return res.status(409).json({ error: "Referencia invalida: el registro relacionado no existe o esta en uso" });
  }
  // Violacion de check / not null
  if (err.code === "23514" || err.code === "23502") {
    return res.status(400).json({ error: "Datos invalidos para la operacion" });
  }
  // Excepcion lanzada por un trigger (ej. jugador sin tutor)
  if (err.code === "P0001") {
    return res.status(400).json({ error: err.message.replace(/^.*?:\s*/, "") || "Operacion rechazada por la base de datos" });
  }

  console.error("Error no controlado:", err);
  res.status(500).json({ error: "Error interno del servidor" });
}

// 404 para rutas no encontradas.
export function notFound(req, res) {
  res.status(404).json({ error: "Recurso no encontrado" });
}

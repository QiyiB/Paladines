import pg from "pg";
import { config } from "./config.js";

// Pool de conexiones contra Neon. Usa el endpoint con -pooler y SSL.
export const pool = new pg.Pool({
  connectionString: config.databaseUrl,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 30000,
});

pool.on("error", (err) => {
  console.error("Error inesperado en el pool de PostgreSQL:", err);
});

// Helper para consultas sueltas (siempre parametrizadas -> anti inyeccion SQL).
export function query(text, params) {
  return pool.query(text, params);
}

// Ejecuta un callback dentro de una transaccion. Hace COMMIT si todo va bien
// y ROLLBACK ante cualquier error. Imprescindible para crear un jugador con
// su(s) tutor(es) en una sola transaccion (el trigger trg_jugador_min_tutor
// es DEFERRABLE INITIALLY DEFERRED y exige >= 1 tutor al hacer COMMIT).
export async function withTransaction(callback) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await callback(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

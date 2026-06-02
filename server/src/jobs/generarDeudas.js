import { pathToFileURL } from "node:url";
import { pool } from "../db.js";

// Llama a la funcion de la BD que, por cada pago vencido con vigencia, genera la
// nueva deuda del siguiente periodo (mensualidad, etc.). Es idempotente: si la
// deuda ya existe no la duplica. Devuelve cuantas deudas creo.
export async function generarDeudasPorVencimiento() {
  const { rows } = await pool.query("SELECT generar_deudas_por_vencimiento() AS creadas");
  return rows[0].creadas;
}

// Permite correrlo como script independiente:  node src/jobs/generarDeudas.js
// (pensado para un cron externo / Programador de tareas de Windows).
const esEjecucionDirecta =
  process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (esEjecucionDirecta) {
  generarDeudasPorVencimiento()
    .then((n) => {
      console.log(`[job deudas] ${new Date().toISOString()} -> deudas generadas: ${n}`);
      return pool.end();
    })
    .then(() => process.exit(0))
    .catch((err) => {
      console.error("[job deudas] error:", err.message);
      process.exit(1);
    });
}

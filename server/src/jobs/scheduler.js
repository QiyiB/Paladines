import { generarDeudasPorVencimiento } from "./generarDeudas.js";

const UN_DIA_MS = 24 * 60 * 60 * 1000;

// Planificador interno: corre el job mientras el servidor este encendido.
// Util para una escuela pequena con el servidor siempre arriba. Como el job es
// idempotente, no pasa nada si se solapa con un cron externo.
export function iniciarJobs() {
  const correr = async () => {
    try {
      const n = await generarDeudasPorVencimiento();
      console.log(`[job deudas] ${new Date().toISOString()} -> deudas generadas: ${n}`);
    } catch (err) {
      console.error("[job deudas] error:", err.message);
    }
  };

  // Corre 10s despues de arrancar (para ponerse al dia) y luego cada 24h.
  setTimeout(correr, 10_000).unref?.();
  setInterval(correr, UN_DIA_MS).unref?.();
  console.log("[jobs] planificador interno activo (deudas por vencimiento cada 24h)");
}

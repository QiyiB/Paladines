import app from "./app.js";
import { config } from "./config.js";
import { iniciarJobs } from "./jobs/scheduler.js";

// Arranque para entorno local / servidor permanente (NO se usa en Vercel,
// donde el entrypoint es api/index.js como funcion serverless).
app.listen(config.port, () => {
  console.log(`API Paladines escuchando en http://localhost:${config.port}`);
  console.log(`CORS permitido para: ${config.clientOrigin}`);
  if (config.jobsEnProceso) iniciarJobs();
});

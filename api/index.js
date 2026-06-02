// Entrypoint de la API como funcion serverless en Vercel.
// Una app de Express es un handler (req, res) valido, asi que basta con
// exportarla. Vercel enruta aqui todas las peticiones /api/* (ver vercel.json).
// No hay app.listen: en serverless no se abre un puerto.
import app from "../server/src/app.js";

export default app;

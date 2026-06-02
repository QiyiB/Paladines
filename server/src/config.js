import dotenv from "dotenv";

dotenv.config();

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Falta la variable de entorno ${name}. Revisa tu archivo .env`);
  }
  return value;
}

export const config = {
  databaseUrl: required("DATABASE_URL"),
  jwtSecret: required("JWT_SECRET"),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
  port: Number(process.env.PORT) || 4000,
  clientOrigin: process.env.CLIENT_ORIGIN || "http://localhost:5173",
  isProduction: process.env.NODE_ENV === "production",
  // Activa el planificador interno de jobs (deudas por vencimiento).
  // Desactivalo si usas un cron externo para no ejecutarlo dos veces.
  jobsEnProceso: (process.env.JOBS_EN_PROCESO || "true") === "true",
};

# Paladines — Escuela de Futbol Infantil

Aplicacion web para la gestion de una escuela de futbol infantil: jugadores, tutores,
categorias, plantillas, sesiones y finanzas. Roles **Admin** y **Profesor**.

## Stack

- **Backend:** Node.js + Express + `pg` (consultas parametrizadas) — capa de API delgada
  sobre la base de datos, que ya contiene la logica de negocio en triggers/vistas.
- **Frontend:** React + Vite + React Router.
- **Base de datos:** PostgreSQL en Neon (ya creada, con ENUMs, triggers y vistas).
- **Auth:** JWT (Bearer) + bcrypt, RBAC verificado en el servidor.

## Requisitos

- Node.js 18+ (probado con Node 24).
- Una base de datos Neon con el esquema ya cargado.

## Configuracion

1. **Backend** — crea `server/.env` a partir de `server/.env.example` y completa:
   - `DATABASE_URL` (cadena de Neon con `sslmode=require`).
   - `JWT_SECRET` (valor largo y aleatorio).
2. **Frontend** — no requiere `.env` en desarrollo (usa el proxy de Vite hacia `:4000`).

> ⚠️ **Seguridad:** el archivo `.env` esta en `.gitignore` y NO debe subirse al repo.
> Si la contrasena de Neon se expuso, rotala desde el panel de Neon.

## Como ejecutar (desarrollo)

En dos terminales:

```bash
# Terminal 1 — backend (http://localhost:4000)
cd server
npm install
npm run dev

# Terminal 2 — frontend (http://localhost:5173)
cd client
npm install
npm run dev
```

Abre http://localhost:5173.

### Usuario inicial

- **Email:** `admin@escuela.com`
- **Contrasena:** `admin123` (cambiala en produccion)

## Estado actual

Implementado y verificado:

**Fase 1 — Cimientos**
- Login con JWT y roles (Admin / Profesor).
- Header con logo Paladines (placeholder — reemplazar por el oficial).
- Navegacion con modulos financieros visibles solo para Admin (y validados en el backend).
- **Tutores:** CRUD + busqueda por nombre/documento + borrado logico.
- **Jugadores:** CRUD + busqueda; alta con >=1 tutor en una transaccion (respeta el
  trigger `trg_jugador_min_tutor`); gestion del tutor principal; estado "en mora".
- La deuda de inscripcion se genera automaticamente al crear un jugador (trigger en BD).

**Fase 2/3 — Categorias y Plantillas**
- **Categorias:** CRUD por rango de anio de nacimiento (pueden traslaparse).
- **Plantillas:** CRUD; **constructor de cancha** que genera las casillas a partir de
  la formacion (4-3-3, 4-2-3-1, etc.: las lineas deben sumar 10 + portero) + 5 de banca.
- Asignacion de jugadores a posiciones con **lista de elegibles** = en rango de anios de
  la categoria **y** sin mora (vista `vw_jugador_en_mora`); validado tambien en el backend.
- Asignacion de **cuerpo tecnico** (DT, asistente, PF...) por plantilla.

**Fase 4 — Sesiones / asistencia**
- **Sesiones:** entrenamiento / amistoso / torneo, ligadas a una plantilla y fecha.
  Rival y marcador solo para amistoso/torneo (regla del CHECK de la BD; el backend
  limpia esos campos en entrenamiento).
- **Asistencia:** se auto-genera con los jugadores asignados a la plantilla al crear la
  sesion; toggle por jugador + motivo si falto; acciones "marcar/desmarcar todos" y
  "sincronizar plantel" (agrega jugadores nuevos del plantel). Resumen presentes/total.

**Fase 5 — Finanzas + gestion de profesores (todo solo-Admin)**
- **Profesores/usuarios:** alta de cuentas por el Admin (sin auto-registro), con contrasena
  temporal y `debe_cambiar_password`; editar, activar/desactivar y resetear clave. El usuario
  cambia su contrasena desde "Cambiar clave" en el header (endpoint `/auth/cambiar-password`).
- **Conceptos de pago:** CRUD; vigencia en dias (NULL = no expira); marca de inscripcion (uno solo).
- **Pagos:** registro (el trigger `preparar_pago` autocompleta monto y `fecha_expiracion`; el
  trigger `saldar_deuda_con_pago` salda la deuda pendiente del concepto); listado con filtros;
  anular (no se borra: vuelve la deuda a PENDIENTE). Auditoria de creacion/anulacion.
- **Deudores:** detalle por jugador de lo que debe (vista `vw_deudores`), con filtro y total.
- **Dashboard:** ingresos del mes (vista `vw_ingresos_mensuales`) y # de jugadores en mora (Admin).
- **RBAC verificado:** el rol PROFESOR recibe 403 en todo el modulo financiero (validado en el backend).

## Job: deudas por vencimiento

Cuando un pago con vigencia (mensualidad, etc.) vence, debe generarse la deuda del
siguiente periodo. La logica vive en la funcion `generar_deudas_por_vencimiento()` de la
BD (es **idempotente**: nunca duplica). Hay tres formas de dispararla:

1. **Planificador interno (por defecto):** mientras el servidor este arriba, corre solo
   ~10s despues de arrancar y luego cada 24h. Se controla con `JOBS_EN_PROCESO` en `.env`.
2. **Script manual / cron externo:** `npm run job:deudas` (abre conexion, ejecuta, cierra).
3. **Combinado:** si usas un cron externo, pon `JOBS_EN_PROCESO=false` para no duplicar
   (aunque por la idempotencia tampoco rompe nada si se solapan).

> Nota: **Neon no soporta pg_cron**, por eso el disparador vive fuera de Postgres.

### Programarlo en Windows (Programador de tareas)

```powershell
schtasks /Create /SC DAILY /ST 03:00 /TN "PaladinesDeudas" ^
  /TR "cmd /c cd /d C:\Users\QiyiB\Desktop\Paladines\server && npm run job:deudas"
```

En un servidor cloud, cualquier cron que ejecute `npm run job:deudas` a diario sirve.

4. **Vercel Cron (en produccion):** Vercel llama a diario al endpoint
   `GET /api/jobs/generar-deudas` (configurado en `vercel.json`). Ese endpoint ejecuta la
   misma funcion. Ahi `JOBS_EN_PROCESO` no aplica (serverless no tiene proceso vivo).

## Despliegue en Vercel

El proyecto esta preparado para desplegarse **todo en Vercel** en un solo proyecto:

- **Frontend** (`client/`): se compila con Vite y se sirve como sitio estatico.
- **API** (`server/`): se expone como **funcion serverless** via `api/index.js`, que solo
  reexporta la app de Express (sin `app.listen`).
- **Cron**: `vercel.json` define un Vercel Cron diario que dispara el job de deudas.

Archivos clave en la raiz: `vercel.json`, `api/index.js`, `package.json` (deps del backend).

### Pasos

1. Sube el repo a GitHub (sin `.env`, ya esta en `.gitignore`).
2. En Vercel: **Add New Project** → importa el repo. No cambies el framework (queda "Other";
   `vercel.json` ya define `buildCommand` y `outputDirectory`).
3. En **Settings → Environment Variables** agrega (entorno Production):

   | Variable | Valor |
   |----------|-------|
   | `DATABASE_URL` | la cadena de Neon (con `-pooler` y `sslmode=require`) |
   | `JWT_SECRET` | un valor largo y aleatorio |
   | `CRON_SECRET` | un valor largo y aleatorio (protege el endpoint del cron) |
   | `JOBS_EN_PROCESO` | `false` |
   | `NODE_ENV` | `production` |
   | `BLOB_READ_WRITE_TOKEN` | se agrega solo al conectar un Blob store (fotos de jugadores) |

4. **Deploy**. El frontend y la API quedan en el **mismo dominio**, asi que el cliente llama
   a `/api/...` sin CORS.

### Como funciona el cron en Vercel

`vercel.json` incluye:

```json
"crons": [{ "path": "/api/jobs/generar-deudas", "schedule": "0 6 * * *" }]
```

A diario (06:00 UTC) Vercel hace una peticion a esa ruta. Si definiste `CRON_SECRET`, Vercel
agrega `Authorization: Bearer <CRON_SECRET>` y el endpoint valida ese token; sin el, responde
401 (para que nadie mas lo dispare). Puedes probarlo manualmente:

```bash
curl -H "Authorization: Bearer TU_CRON_SECRET" https://TU-APP.vercel.app/api/jobs/generar-deudas
```

> Plan Hobby de Vercel: los crons corren como minimo 1 vez al dia (suficiente aqui).

## Siguientes fases / pendientes

- Endurecimiento: revisar cookies httpOnly vs JWT, CSP/HSTS en prod, rotacion de secretos.
- (Menor) El driver `pg` muestra un warning de deprecacion sobre `sslmode=require`; la
  conexion funciona y es segura. Para silenciarlo se puede usar `sslmode=verify-full`.

## Estructura

```
Paladines/
├── server/        # API Express
│   └── src/
│       ├── routes/        # auth, tutores, jugadores
│       ├── middleware/     # auth (JWT/roles), manejo de errores
│       ├── db.js          # pool de Neon + helper de transacciones
│       └── index.js
└── client/        # React + Vite
    └── src/
        ├── api/           # cliente HTTP
        ├── context/       # AuthContext
        ├── components/    # Header, Layout, Logo, ProtectedRoute
        └── pages/         # Login, Dashboard, Jugadores, Tutores
```

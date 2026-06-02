import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";
import { money } from "./ConceptosPage.jsx";

export default function DashboardPage() {
  const { usuario, esAdmin } = useAuth();
  const [stats, setStats] = useState({ jugadores: 0, tutores: 0, deudores: null, ingresosMes: null });

  useEffect(() => {
    (async () => {
      try {
        const [jugadores, tutores] = await Promise.all([api("/jugadores"), api("/tutores")]);
        setStats((s) => ({ ...s, jugadores: jugadores.length, tutores: tutores.length }));
      } catch {
        /* ignora errores de carga inicial */
      }
      if (esAdmin) {
        try {
          const [deudores, ingresos] = await Promise.all([api("/deudores"), api("/pagos/ingresos-mes")]);
          setStats((s) => ({ ...s, deudores: deudores.length, ingresosMes: Number(ingresos.total) }));
        } catch {
          /* ignora */
        }
      }
    })();
  }, [esAdmin]);

  return (
    <div>
      <h2 className="page-title">Dashboard</h2>
      <p className="muted">Bienvenido, {usuario?.nombre}.</p>

      {usuario?.debe_cambiar_password && (
        <div className="alert alert-warn">
          Tienes una contrasena temporal. Usa "Cambiar clave" (arriba a la derecha) para definir una nueva.
        </div>
      )}

      <div className="stat-grid">
        <div className="stat-card">
          <span className="stat-value">{stats.jugadores}</span>
          <span className="stat-label">Jugadores activos</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.tutores}</span>
          <span className="stat-label">Tutores activos</span>
        </div>
        {esAdmin && (
          <>
            <div className="stat-card">
              <span className="stat-value">{stats.deudores ?? "…"}</span>
              <span className="stat-label">Jugadores en mora</span>
            </div>
            <div className="stat-card">
              <span className="stat-value" style={{ fontSize: "1.5rem" }}>
                {stats.ingresosMes == null ? "…" : money(stats.ingresosMes)}
              </span>
              <span className="stat-label">Ingresos del mes</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

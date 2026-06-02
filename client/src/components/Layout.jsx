import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import Header from "./Header.jsx";
import AccountMenu from "./AccountMenu.jsx";
import { useAuth } from "../context/AuthContext.jsx";

// Estructura general: header arriba, navegacion lateral y contenido.
// En movil la barra lateral se vuelve un cajon deslizable.
// Los modulos financieros solo se muestran a ADMIN (ademas de validarse en el backend).
export default function Layout() {
  const { esAdmin } = useAuth();
  const [menuAbierto, setMenuAbierto] = useState(false);
  const cerrar = () => setMenuAbierto(false);

  const enlaces = [
    { to: "/", label: "Dashboard", end: true },
    { to: "/jugadores", label: "Jugadores" },
    { to: "/tutores", label: "Tutores" },
    { to: "/categorias", label: "Categorias" },
    { to: "/plantillas", label: "Plantillas" },
    { to: "/sesiones", label: "Sesiones" },
  ];

  const enlacesAdmin = [
    { to: "/usuarios", label: "Profesores" },
    { to: "/conceptos", label: "Conceptos" },
    { to: "/pagos", label: "Pagos" },
    { to: "/deudores", label: "Deudores" },
  ];

  return (
    <div className="app-shell">
      <Header onMenu={() => setMenuAbierto(true)} />

      {menuAbierto && <button className="sidebar-backdrop" aria-label="Cerrar menu" onClick={cerrar} />}

      <div className="app-body">
        <nav className={`sidebar ${menuAbierto ? "abierto" : ""}`}>
          <div className="sidebar-close">
            <span>MENU</span>
            <button onClick={cerrar} aria-label="Cerrar menu">✕</button>
          </div>

          {enlaces.map((e) => (
            <NavLink key={e.to} to={e.to} end={e.end} className="nav-link" onClick={cerrar}>
              {e.label}
            </NavLink>
          ))}

          {esAdmin && (
            <>
              <div className="nav-sep">Administracion</div>
              {enlacesAdmin.map((e) => (
                <NavLink key={e.to} to={e.to} className="nav-link" onClick={cerrar}>
                  {e.label} <span className="badge-admin">Admin</span>
                </NavLink>
              ))}
            </>
          )}

          <AccountMenu variant="drawer" />
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

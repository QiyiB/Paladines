import { useState } from "react";
import { useAuth } from "../context/AuthContext.jsx";
import CambiarPassword from "./CambiarPassword.jsx";

// Datos del usuario + acciones de cuenta. Se reutiliza en el header (escritorio)
// y dentro del cajon de navegacion (movil). variant solo cambia clases de estilo.
export default function AccountMenu({ variant = "header" }) {
  const { usuario, logout } = useAuth();
  const [cambiando, setCambiando] = useState(false);
  if (!usuario) return null;

  return (
    <div className={`account account-${variant}`}>
      <div className="user-info">
        <span className="user-name">{usuario.nombre}</span>
        <span className={`user-rol rol-${usuario.rol.toLowerCase()}`}>{usuario.rol}</span>
      </div>
      <button className="btn btn-ghost btn-sm" onClick={() => setCambiando(true)}>Cambiar clave</button>
      <button className="btn btn-ghost btn-sm" onClick={logout}>Cerrar sesion</button>
      {cambiando && <CambiarPassword onClose={() => setCambiando(false)} />}
    </div>
  );
}

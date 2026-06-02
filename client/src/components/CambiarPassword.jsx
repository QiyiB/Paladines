import { useState } from "react";
import { createPortal } from "react-dom";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

// Modal para que el usuario cambie su propia contrasena (incluye la temporal).
export default function CambiarPassword({ onClose }) {
  const { usuario, setUsuario } = useAuth();
  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [repetir, setRepetir] = useState("");
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    if (nueva.length < 8) return setError("La nueva contrasena debe tener al menos 8 caracteres");
    if (nueva !== repetir) return setError("Las contrasenas no coinciden");
    try {
      await api("/auth/cambiar-password", { method: "POST", body: { password_actual: actual, password_nueva: nueva } });
      setOk(true);
      setUsuario({ ...usuario, debe_cambiar_password: false });
      setTimeout(onClose, 900);
    } catch (err) {
      setError(err.message);
    }
  }

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <h3>Cambiar contrasena</h3>
        {error && <div className="alert alert-error">{error}</div>}
        {ok && <div className="alert alert-warn">Contrasena actualizada.</div>}
        <label className="field"><span>Contrasena actual</span>
          <input type="password" value={actual} onChange={(e) => setActual(e.target.value)} required autoComplete="current-password" /></label>
        <label className="field"><span>Nueva contrasena</span>
          <input type="password" value={nueva} onChange={(e) => setNueva(e.target.value)} required autoComplete="new-password" /></label>
        <label className="field"><span>Repetir nueva contrasena</span>
          <input type="password" value={repetir} onChange={(e) => setRepetir(e.target.value)} required autoComplete="new-password" /></label>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar</button>
          <button className="btn btn-primary">Guardar</button>
        </div>
      </form>
    </div>,
    document.body
  );
}

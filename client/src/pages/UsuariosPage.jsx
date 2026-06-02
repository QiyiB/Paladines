import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

const ROLES = ["PROFESOR", "ADMIN"];

export default function UsuariosPage() {
  const { usuario: actual } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      setUsuarios(await api("/usuarios"));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  async function guardar(e) {
    e.preventDefault();
    setError("");
    try {
      if (form.id) {
        await api(`/usuarios/${form.id}`, { method: "PUT", body: { nombre: form.nombre, rol: form.rol, activo: form.activo } });
      } else {
        await api("/usuarios", { method: "POST", body: { email: form.email, nombre: form.nombre, rol: form.rol, password: form.password } });
      }
      setForm(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function toggleActivo(u) {
    setError("");
    try {
      await api(`/usuarios/${u.id}`, { method: "PUT", body: { nombre: u.nombre, rol: u.rol, activo: !u.activo } });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function resetPassword(u) {
    const nueva = prompt(`Nueva contrasena temporal para ${u.nombre} (min 8 caracteres):`);
    if (!nueva) return;
    setError("");
    try {
      await api(`/usuarios/${u.id}/reset-password`, { method: "POST", body: { password: nueva } });
      alert("Contrasena restablecida. El usuario debera cambiarla al ingresar.");
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Usuarios / Profesores</h2>
        <button className="btn btn-primary" onClick={() => { setError(""); setForm({ email: "", nombre: "", rol: "PROFESOR", password: "" }); }}>
          + Nueva cuenta
        </button>
      </div>
      <p className="muted">No hay auto-registro: solo el administrador crea cuentas. La cuenta nace con contrasena temporal.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Nombre</th><th>Email</th><th>Rol</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          {cargando && <tr><td colSpan={5} className="muted">Cargando...</td></tr>}
          {usuarios.map((u) => (
            <tr key={u.id}>
              <td>{u.nombre} {u.id === actual.id && <span className="muted">(tu)</span>}</td>
              <td>{u.email}</td>
              <td><span className={`user-rol rol-${u.rol.toLowerCase()}`}>{u.rol}</span></td>
              <td>
                {u.activo ? <span className="badge badge-ok">Activo</span> : <span className="badge badge-danger">Inactivo</span>}
                {u.debe_cambiar_password && <span className="badge badge-warn" style={{ marginLeft: 4 }}>cambia clave</span>}
              </td>
              <td className="row-actions">
                <button className="btn btn-sm" onClick={() => { setError(""); setForm({ ...u }); }}>Editar</button>
                <button className="btn btn-sm" onClick={() => resetPassword(u)}>Reset clave</button>
                {u.id !== actual.id && (
                  <button className="btn btn-sm btn-danger" onClick={() => toggleActivo(u)}>
                    {u.activo ? "Desactivar" : "Activar"}
                  </button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
            <h3>{form.id ? "Editar usuario" : "Nueva cuenta"}</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-grid">
              <label className="field field-wide"><span>Nombre *</span>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
              {!form.id && (
                <label className="field field-wide"><span>Email *</span>
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required /></label>
              )}
              <label className="field"><span>Rol *</span>
                <select value={form.rol} onChange={(e) => setForm({ ...form, rol: e.target.value })}>
                  {ROLES.map((r) => <option key={r}>{r}</option>)}
                </select></label>
              {!form.id && (
                <label className="field"><span>Contrasena temporal *</span>
                  <input type="text" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} /></label>
              )}
            </div>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setForm(null)}>Cancelar</button>
              <button className="btn btn-primary">Guardar</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

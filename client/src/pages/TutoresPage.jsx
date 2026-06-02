import { useEffect, useState } from "react";
import { api } from "../api/client.js";

const TIPOS_DOC = ["CC", "TI", "RC", "CE", "PAS"];
const VACIO = { tipo_documento: "CC", numero_documento: "", nombre: "", apellido: "", telefono: "", email: "", direccion: "" };

export default function TutoresPage() {
  const [tutores, setTutores] = useState([]);
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState(null); // null = formulario cerrado
  const [error, setError] = useState("");

  async function cargar() {
    setCargando(true);
    try {
      const data = await api(`/tutores${q ? `?q=${encodeURIComponent(q)}` : ""}`);
      setTutores(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function nuevo() {
    setError("");
    setForm({ ...VACIO });
  }
  function editar(t) {
    setError("");
    setForm({ ...t });
  }

  async function guardar(e) {
    e.preventDefault();
    setError("");
    try {
      if (form.id) {
        await api(`/tutores/${form.id}`, { method: "PUT", body: form });
      } else {
        await api("/tutores", { method: "POST", body: form });
      }
      setForm(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  async function eliminar(t) {
    if (!confirm(`Desactivar al tutor ${t.nombre} ${t.apellido}?`)) return;
    try {
      await api(`/tutores/${t.id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Tutores</h2>
        <button className="btn btn-primary" onClick={nuevo}>+ Nuevo tutor</button>
      </div>

      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); cargar(); }}>
        <input
          placeholder="Buscar por nombre o documento..."
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <button className="btn">Buscar</button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap"><table className="data-table">
        <thead>
          <tr>
            <th>Documento</th><th>Nombre</th><th>Telefono</th><th>Email</th><th></th>
          </tr>
        </thead>
        <tbody>
          {cargando && <tr><td colSpan={5} className="muted">Cargando...</td></tr>}
          {!cargando && tutores.length === 0 && <tr><td colSpan={5} className="muted">Sin resultados.</td></tr>}
          {tutores.map((t) => (
            <tr key={t.id}>
              <td>{t.tipo_documento} {t.numero_documento}</td>
              <td>{t.nombre} {t.apellido}</td>
              <td>{t.telefono || "—"}</td>
              <td>{t.email || "—"}</td>
              <td className="row-actions">
                <button className="btn btn-sm" onClick={() => editar(t)}>Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => eliminar(t)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
            <h3>{form.id ? "Editar tutor" : "Nuevo tutor"}</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-grid">
              <label className="field">
                <span>Tipo doc.</span>
                <select value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}>
                  {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Numero documento *</span>
                <input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} required />
              </label>
              <label className="field">
                <span>Nombre *</span>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </label>
              <label className="field">
                <span>Apellido *</span>
                <input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required />
              </label>
              <label className="field">
                <span>Telefono</span>
                <input value={form.telefono || ""} onChange={(e) => setForm({ ...form, telefono: e.target.value })} />
              </label>
              <label className="field">
                <span>Email</span>
                <input type="email" value={form.email || ""} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </label>
              <label className="field field-wide">
                <span>Direccion</span>
                <input value={form.direccion || ""} onChange={(e) => setForm({ ...form, direccion: e.target.value })} />
              </label>
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

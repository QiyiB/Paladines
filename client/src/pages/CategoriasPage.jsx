import { useEffect, useState } from "react";
import { api } from "../api/client.js";

const VACIO = { nombre: "", anio_min: "", anio_max: "" };

export default function CategoriasPage() {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [form, setForm] = useState(null);
  const [error, setError] = useState("");

  async function cargar() {
    setCargando(true);
    try {
      setCategorias(await api("/categorias"));
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
      if (form.id) await api(`/categorias/${form.id}`, { method: "PUT", body: form });
      else await api("/categorias", { method: "POST", body: form });
      setForm(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }
  async function eliminar(c) {
    if (!confirm(`Desactivar la categoria ${c.nombre}?`)) return;
    try {
      await api(`/categorias/${c.id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Categorias</h2>
        <button className="btn btn-primary" onClick={() => { setError(""); setForm({ ...VACIO }); }}>
          + Nueva categoria
        </button>
      </div>
      <p className="muted">Cada categoria agrupa por rango de año de nacimiento (pueden traslaparse).</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Nombre</th><th>Rango de años</th><th></th></tr></thead>
        <tbody>
          {cargando && <tr><td colSpan={3} className="muted">Cargando...</td></tr>}
          {!cargando && categorias.length === 0 && <tr><td colSpan={3} className="muted">Sin categorias.</td></tr>}
          {categorias.map((c) => (
            <tr key={c.id}>
              <td>{c.nombre}</td>
              <td>{c.anio_min} – {c.anio_max}</td>
              <td className="row-actions">
                <button className="btn btn-sm" onClick={() => { setError(""); setForm({ ...c }); }}>Editar</button>
                <button className="btn btn-sm btn-danger" onClick={() => eliminar(c)}>Eliminar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {form && (
        <div className="modal-overlay" onClick={() => setForm(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
            <h3>{form.id ? "Editar categoria" : "Nueva categoria"}</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-grid">
              <label className="field field-wide">
                <span>Nombre *</span>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required />
              </label>
              <label className="field">
                <span>Año min *</span>
                <input type="number" value={form.anio_min} onChange={(e) => setForm({ ...form, anio_min: e.target.value })} required />
              </label>
              <label className="field">
                <span>Año max *</span>
                <input type="number" value={form.anio_max} onChange={(e) => setForm({ ...form, anio_max: e.target.value })} required />
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

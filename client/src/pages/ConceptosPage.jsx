import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export const money = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n || 0));

const VACIO = { nombre: "", monto: "", vigencia_dias: "", es_inscripcion: false };

export default function ConceptosPage() {
  const [conceptos, setConceptos] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      setConceptos(await api("/conceptos"));
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
      if (form.id) await api(`/conceptos/${form.id}`, { method: "PUT", body: form });
      else await api("/conceptos", { method: "POST", body: form });
      setForm(null);
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }
  async function eliminar(c) {
    if (!confirm(`Desactivar el concepto ${c.nombre}?`)) return;
    try {
      await api(`/conceptos/${c.id}`, { method: "DELETE" });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Conceptos de pago</h2>
        <button className="btn btn-primary" onClick={() => { setError(""); setForm({ ...VACIO }); }}>+ Nuevo concepto</button>
      </div>
      <p className="muted">La vigencia en dias define cuanto vale un pago (Inscripcion=365, Mensualidad=30). Vacio = no expira.</p>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Concepto</th><th>Monto</th><th>Vigencia</th><th>Inscripcion</th><th></th></tr></thead>
        <tbody>
          {cargando && <tr><td colSpan={5} className="muted">Cargando...</td></tr>}
          {!cargando && conceptos.length === 0 && <tr><td colSpan={5} className="muted">Sin conceptos.</td></tr>}
          {conceptos.map((c) => (
            <tr key={c.id}>
              <td>{c.nombre}</td>
              <td>{money(c.monto)}</td>
              <td>{c.vigencia_dias ? `${c.vigencia_dias} dias` : "No expira"}</td>
              <td>{c.es_inscripcion ? <span className="badge badge-ok">Si</span> : "—"}</td>
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
            <h3>{form.id ? "Editar concepto" : "Nuevo concepto"}</h3>
            {error && <div className="alert alert-error">{error}</div>}
            <div className="form-grid">
              <label className="field field-wide"><span>Nombre *</span>
                <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
              <label className="field"><span>Monto *</span>
                <input type="number" min="0" value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} required /></label>
              <label className="field"><span>Vigencia (dias)</span>
                <input type="number" min="1" placeholder="No expira" value={form.vigencia_dias ?? ""} onChange={(e) => setForm({ ...form, vigencia_dias: e.target.value })} /></label>
              <label className="field field-wide radio">
                <input type="checkbox" checked={!!form.es_inscripcion} onChange={(e) => setForm({ ...form, es_inscripcion: e.target.checked })} />
                Es el concepto de inscripcion (solo uno; genera la deuda automatica al crear un jugador)
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

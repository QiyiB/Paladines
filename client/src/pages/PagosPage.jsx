import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { money } from "./ConceptosPage.jsx";

const METODOS = ["EFECTIVO", "TRANSFERENCIA", "TARJETA", "NEQUI", "DAVIPLATA", "PSE", "OTRO"];

export default function PagosPage() {
  const [pagos, setPagos] = useState([]);
  const [q, setQ] = useState("");
  const [incluirAnulados, setIncluirAnulados] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [registrando, setRegistrando] = useState(false);

  async function cargar() {
    setCargando(true);
    try {
      const params = new URLSearchParams();
      if (q) params.set("q", q);
      if (incluirAnulados) params.set("incluir_anulados", "true");
      setPagos(await api(`/pagos?${params.toString()}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [incluirAnulados]);

  async function anular(p) {
    if (!confirm(`Anular el pago de ${money(p.monto)} de ${p.jugador_nombre} ${p.jugador_apellido}? La deuda volvera a quedar pendiente.`)) return;
    try {
      await api(`/pagos/${p.id}/anular`, { method: "POST" });
      cargar();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Pagos</h2>
        <button className="btn btn-primary" onClick={() => { setError(""); setRegistrando(true); }}>+ Registrar pago</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); cargar(); }}>
        <input placeholder="Buscar por jugador..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">Buscar</button>
        <label className="radio" style={{ marginLeft: 8 }}>
          <input type="checkbox" checked={incluirAnulados} onChange={(e) => setIncluirAnulados(e.target.checked)} />
          Incluir anulados
        </label>
      </form>

      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Fecha</th><th>Jugador</th><th>Concepto</th><th>Metodo</th><th>Monto</th><th>Expira</th><th></th></tr></thead>
        <tbody>
          {cargando && <tr><td colSpan={7} className="muted">Cargando...</td></tr>}
          {!cargando && pagos.length === 0 && <tr><td colSpan={7} className="muted">Sin pagos.</td></tr>}
          {pagos.map((p) => (
            <tr key={p.id} style={p.anulado ? { opacity: 0.5, textDecoration: "line-through" } : undefined}>
              <td>{String(p.fecha_pago).slice(0, 10)}</td>
              <td>{p.jugador_apellido} {p.jugador_nombre}</td>
              <td>{p.concepto}</td>
              <td>{p.metodo}</td>
              <td>{money(p.monto)}</td>
              <td>{p.fecha_expiracion ? String(p.fecha_expiracion).slice(0, 10) : "—"}</td>
              <td className="row-actions">
                {p.anulado ? <span className="badge badge-danger">Anulado</span>
                  : <button className="btn btn-sm btn-danger" onClick={() => anular(p)}>Anular</button>}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {registrando && (
        <FormularioPago onClose={() => setRegistrando(false)} onSaved={() => { setRegistrando(false); cargar(); }} />
      )}
    </div>
  );
}

function FormularioPago({ onClose, onSaved }) {
  const [conceptos, setConceptos] = useState([]);
  const [buscar, setBuscar] = useState("");
  const [resultados, setResultados] = useState([]);
  const [jugador, setJugador] = useState(null);
  const [form, setForm] = useState({ concepto_id: "", metodo: "EFECTIVO", fecha_pago: "", monto: "" });
  const [error, setError] = useState("");

  useEffect(() => { api("/conceptos").then((cs) => { setConceptos(cs); setForm((f) => ({ ...f, concepto_id: cs[0]?.id || "" })); }).catch(() => {}); }, []);

  async function buscarJugador(e) {
    e.preventDefault();
    try {
      setResultados(await api(`/jugadores?q=${encodeURIComponent(buscar)}`));
    } catch (err) { setError(err.message); }
  }

  const conceptoSel = conceptos.find((c) => String(c.id) === String(form.concepto_id));

  async function guardar(e) {
    e.preventDefault();
    setError("");
    if (!jugador) { setError("Selecciona un jugador"); return; }
    try {
      await api("/pagos", { method: "POST", body: { jugador_id: jugador.id, concepto_id: form.concepto_id, metodo: form.metodo, fecha_pago: form.fecha_pago || undefined, monto: form.monto || undefined } });
      onSaved();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal modal-lg" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <h3>Registrar pago</h3>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="subsection" style={{ marginTop: 0, borderTop: "none", paddingTop: 0 }}>
          <h4>Jugador</h4>
          {jugador ? (
            <div className="vinculo-row">
              <strong>{jugador.apellido} {jugador.nombre}</strong>
              <span className="muted">{jugador.numero_documento}</span>
              <button type="button" className="btn btn-sm" onClick={() => setJugador(null)}>Cambiar</button>
            </div>
          ) : (
            <>
              <div className="tutor-picker">
                <input placeholder="Buscar jugador por nombre o documento..." value={buscar} onChange={(e) => setBuscar(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") buscarJugador(e); }} />
                <button type="button" className="btn" onClick={buscarJugador}>Buscar</button>
              </div>
              {resultados.map((j) => (
                <div key={j.id} className="vinculo-row">
                  <strong>{j.apellido} {j.nombre}</strong>
                  <span className="muted">{j.numero_documento} · {j.edad} años</span>
                  <button type="button" className="btn btn-sm btn-primary" onClick={() => { setJugador(j); setResultados([]); }}>Elegir</button>
                </div>
              ))}
            </>
          )}
        </div>

        <div className="form-grid">
          <label className="field"><span>Concepto *</span>
            <select value={form.concepto_id} onChange={(e) => setForm({ ...form, concepto_id: e.target.value })}>
              {conceptos.map((c) => <option key={c.id} value={c.id}>{c.nombre} · {money(c.monto)}</option>)}
            </select></label>
          <label className="field"><span>Metodo *</span>
            <select value={form.metodo} onChange={(e) => setForm({ ...form, metodo: e.target.value })}>
              {METODOS.map((m) => <option key={m}>{m}</option>)}
            </select></label>
          <label className="field"><span>Fecha (vacio = hoy)</span>
            <input type="date" value={form.fecha_pago} onChange={(e) => setForm({ ...form, fecha_pago: e.target.value })} /></label>
          <label className="field"><span>Monto (vacio = del concepto)</span>
            <input type="number" min="0" placeholder={conceptoSel ? String(conceptoSel.monto) : ""} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} /></label>
        </div>
        {conceptoSel?.vigencia_dias && <p className="muted">Este pago vencera en {conceptoSel.vigencia_dias} dias y generara una nueva deuda al vencer.</p>}

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary">Registrar pago</button>
        </div>
      </form>
    </div>
  );
}

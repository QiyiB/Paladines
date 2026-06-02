import { useEffect, useState } from "react";
import { api } from "../api/client.js";

const TIPOS = ["ENTRENAMIENTO", "AMISTOSO", "TORNEO"];

function fechaCorta(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export default function SesionesPage() {
  const [sesiones, setSesiones] = useState([]);
  const [plantillas, setPlantillas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [abierta, setAbierta] = useState(null);
  const [filtroTipo, setFiltroTipo] = useState("");

  async function cargar() {
    setCargando(true);
    try {
      const [ses, pls] = await Promise.all([
        api(`/sesiones${filtroTipo ? `?tipo=${filtroTipo}` : ""}`),
        api("/plantillas"),
      ]);
      setSesiones(ses);
      setPlantillas(pls);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [filtroTipo]);

  if (abierta) {
    return <DetalleSesion id={abierta} onClose={() => { setAbierta(null); cargar(); }} />;
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Sesiones</h2>
        <button className="btn btn-primary" disabled={plantillas.length === 0}
          onClick={() => { setError(""); setCreando(true); }}>
          + Nueva sesion
        </button>
      </div>

      {plantillas.length === 0 && <div className="alert alert-warn">Crea primero una plantilla.</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="search-bar">
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)}>
          <option value="">Todos los tipos</option>
          {TIPOS.map((t) => <option key={t}>{t}</option>)}
        </select>
      </div>

      <div className="table-wrap"><table className="data-table">
        <thead>
          <tr><th>Fecha</th><th>Tipo</th><th>Plantilla</th><th>Detalle</th><th>Asistencia</th><th></th></tr>
        </thead>
        <tbody>
          {cargando && <tr><td colSpan={6} className="muted">Cargando...</td></tr>}
          {!cargando && sesiones.length === 0 && <tr><td colSpan={6} className="muted">Sin sesiones.</td></tr>}
          {sesiones.map((s) => (
            <tr key={s.id}>
              <td>{fechaCorta(s.fecha)}</td>
              <td><span className={`badge ${s.tipo === "ENTRENAMIENTO" ? "badge-ok" : "badge-danger"}`}>{s.tipo}</span></td>
              <td>{s.plantilla_nombre}</td>
              <td>
                {s.tipo === "ENTRENAMIENTO"
                  ? (s.descripcion || "—")
                  : `vs ${s.rival || "?"} ${s.marcador_local ?? "-"}:${s.marcador_visitante ?? "-"}`}
              </td>
              <td>{s.presentes}/{s.total}</td>
              <td className="row-actions">
                <button className="btn btn-sm btn-primary" onClick={() => setAbierta(s.id)}>Abrir</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {creando && (
        <FormularioNueva plantillas={plantillas}
          onClose={() => setCreando(false)}
          onSaved={(id) => { setCreando(false); cargar(); setAbierta(id); }} />
      )}
    </div>
  );
}

function FormularioNueva({ plantillas, onClose, onSaved }) {
  const [form, setForm] = useState({
    tipo: "ENTRENAMIENTO", plantilla_id: plantillas[0]?.id || "", fecha: "",
    descripcion: "", rival: "", marcador_local: "", marcador_visitante: "",
  });
  const [error, setError] = useState("");
  const esPartido = form.tipo !== "ENTRENAMIENTO";

  async function guardar(e) {
    e.preventDefault();
    setError("");
    try {
      const s = await api("/sesiones", { method: "POST", body: form });
      onSaved(s.id);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <h3>Nueva sesion</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <label className="field"><span>Tipo *</span>
            <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
              {TIPOS.map((t) => <option key={t}>{t}</option>)}
            </select></label>
          <label className="field"><span>Plantilla *</span>
            <select value={form.plantilla_id} onChange={(e) => setForm({ ...form, plantilla_id: e.target.value })}>
              {plantillas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </select></label>
          <label className="field field-wide"><span>Fecha y hora *</span>
            <input type="datetime-local" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} required /></label>
          <label className="field field-wide"><span>Descripcion</span>
            <input value={form.descripcion} placeholder={esPartido ? "Torneo X / Amistoso..." : "Entrenamiento..."}
              onChange={(e) => setForm({ ...form, descripcion: e.target.value })} /></label>

          {esPartido && (
            <>
              <label className="field field-wide"><span>Rival</span>
                <input value={form.rival} onChange={(e) => setForm({ ...form, rival: e.target.value })} /></label>
              <label className="field"><span>Marcador local</span>
                <input type="number" min="0" value={form.marcador_local} onChange={(e) => setForm({ ...form, marcador_local: e.target.value })} /></label>
              <label className="field"><span>Marcador visitante</span>
                <input type="number" min="0" value={form.marcador_visitante} onChange={(e) => setForm({ ...form, marcador_visitante: e.target.value })} /></label>
            </>
          )}
        </div>
        <p className="muted">La lista de asistencia se genera con los jugadores asignados a la plantilla.</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary">Crear sesion</button>
        </div>
      </form>
    </div>
  );
}

function DetalleSesion({ id, onClose }) {
  const [sesion, setSesion] = useState(null);
  const [filas, setFilas] = useState([]);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState(false);

  async function cargar() {
    try {
      const s = await api(`/sesiones/${id}`);
      setSesion(s);
      setFilas(s.asistencia.map((a) => ({ ...a })));
    } catch (err) { setError(err.message); }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, [id]);

  function set(jid, campo, valor) {
    setFilas(filas.map((f) => (f.jugador_id === jid ? { ...f, [campo]: valor } : f)));
    setGuardado(false);
  }
  function marcarTodos(valor) {
    setFilas(filas.map((f) => ({ ...f, asistio: valor })));
    setGuardado(false);
  }

  async function guardar() {
    setError("");
    try {
      await api(`/sesiones/${id}/asistencia`, {
        method: "PUT",
        body: { asistencias: filas.map((f) => ({ jugador_id: f.jugador_id, asistio: f.asistio, motivo: f.motivo })) },
      });
      setGuardado(true);
    } catch (err) { setError(err.message); }
  }
  async function sincronizar() {
    setError("");
    try {
      const r = await api(`/sesiones/${id}/sincronizar`, { method: "POST" });
      await cargar();
      alert(`Jugadores agregados: ${r.agregados}`);
    } catch (err) { setError(err.message); }
  }
  async function eliminar() {
    if (!confirm("Eliminar esta sesion y su asistencia?")) return;
    try {
      await api(`/sesiones/${id}`, { method: "DELETE" });
      onClose();
    } catch (err) { setError(err.message); }
  }

  if (!sesion) return <div className="muted">Cargando...</div>;
  const presentes = filas.filter((f) => f.asistio).length;

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn btn-ghost" onClick={onClose}>← Volver</button>
          <h2 className="page-title" style={{ display: "inline", marginLeft: 8 }}>
            {sesion.tipo} · {sesion.plantilla_nombre}
          </h2>
        </div>
        <button className="btn btn-danger" onClick={eliminar}>Eliminar sesion</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        <div className="detalle-grid">
          <div><span className="muted">Fecha</span><div>{fechaCorta(sesion.fecha)}</div></div>
          <div><span className="muted">Descripcion</span><div>{sesion.descripcion || "—"}</div></div>
          {sesion.tipo !== "ENTRENAMIENTO" && (
            <>
              <div><span className="muted">Rival</span><div>{sesion.rival || "—"}</div></div>
              <div><span className="muted">Marcador</span><div>{sesion.marcador_local ?? "-"} : {sesion.marcador_visitante ?? "-"}</div></div>
            </>
          )}
        </div>
      </div>

      <div className="page-head" style={{ marginTop: "1.2rem" }}>
        <h3>Asistencia · {presentes}/{filas.length} presentes</h3>
        <div className="row-actions">
          <button className="btn btn-sm" onClick={() => marcarTodos(true)}>Marcar todos</button>
          <button className="btn btn-sm" onClick={() => marcarTodos(false)}>Desmarcar</button>
          <button className="btn btn-sm" onClick={sincronizar}>Sincronizar plantel</button>
        </div>
      </div>

      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Jugador</th><th>Documento</th><th>Asistio</th><th>Motivo (si falto)</th></tr></thead>
        <tbody>
          {filas.length === 0 && <tr><td colSpan={4} className="muted">No hay jugadores. Asigna jugadores a la plantilla y usa "Sincronizar plantel".</td></tr>}
          {filas.map((f) => (
            <tr key={f.jugador_id}>
              <td>{f.apellido} {f.nombre}</td>
              <td>{f.numero_documento}</td>
              <td>
                <input type="checkbox" checked={!!f.asistio} onChange={(e) => set(f.jugador_id, "asistio", e.target.checked)} />
              </td>
              <td>
                <input value={f.motivo || ""} placeholder="—" disabled={f.asistio}
                  onChange={(e) => set(f.jugador_id, "motivo", e.target.value)} style={{ width: "100%" }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <div className="modal-actions">
        {guardado && <span className="badge badge-ok" style={{ alignSelf: "center" }}>Guardado</span>}
        <button className="btn btn-primary" onClick={guardar} disabled={filas.length === 0}>Guardar asistencia</button>
      </div>
    </div>
  );
}

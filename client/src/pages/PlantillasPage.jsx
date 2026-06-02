import { useEffect, useState } from "react";
import { api } from "../api/client.js";

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [abierta, setAbierta] = useState(null); // id de plantilla en el constructor

  async function cargar() {
    setCargando(true);
    try {
      const [pls, cats] = await Promise.all([api("/plantillas"), api("/categorias")]);
      setPlantillas(pls);
      setCategorias(cats);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { cargar(); }, []);

  if (abierta) {
    return <Constructor id={abierta} onClose={() => { setAbierta(null); cargar(); }} />;
  }

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Plantillas</h2>
        <button className="btn btn-primary" disabled={categorias.length === 0}
          onClick={() => { setError(""); setCreando(true); }}>
          + Nueva plantilla
        </button>
      </div>

      {categorias.length === 0 && <div className="alert alert-warn">Crea primero una categoria.</div>}
      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap"><table className="data-table">
        <thead><tr><th>Nombre</th><th>Categoria</th><th>Formacion</th><th>Asignados</th><th></th></tr></thead>
        <tbody>
          {cargando && <tr><td colSpan={5} className="muted">Cargando...</td></tr>}
          {!cargando && plantillas.length === 0 && <tr><td colSpan={5} className="muted">Sin plantillas.</td></tr>}
          {plantillas.map((p) => (
            <tr key={p.id}>
              <td>{p.nombre}</td>
              <td>{p.categoria_nombre} ({p.anio_min}–{p.anio_max})</td>
              <td>{p.formacion}</td>
              <td>{p.asignados}/11</td>
              <td className="row-actions">
                <button className="btn btn-sm btn-primary" onClick={() => setAbierta(p.id)}>Abrir cancha</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {creando && (
        <FormularioNueva categorias={categorias}
          onClose={() => setCreando(false)}
          onSaved={(id) => { setCreando(false); cargar(); setAbierta(id); }} />
      )}
    </div>
  );
}

function FormularioNueva({ categorias, onClose, onSaved }) {
  const [form, setForm] = useState({ nombre: "", categoria_id: categorias[0]?.id || "", formacion: "4-3-3" });
  const [error, setError] = useState("");
  const FORMACIONES = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "4-1-2-3"];

  async function guardar(e) {
    e.preventDefault();
    setError("");
    try {
      const pl = await api("/plantillas", { method: "POST", body: form });
      onSaved(pl.id);
    } catch (err) {
      setError(err.message);
    }
  }
  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <h3>Nueva plantilla</h3>
        {error && <div className="alert alert-error">{error}</div>}
        <div className="form-grid">
          <label className="field field-wide"><span>Nombre *</span>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
          <label className="field"><span>Categoria *</span>
            <select value={form.categoria_id} onChange={(e) => setForm({ ...form, categoria_id: e.target.value })}>
              {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </select></label>
          <label className="field"><span>Formacion *</span>
            <select value={form.formacion} onChange={(e) => setForm({ ...form, formacion: e.target.value })}>
              {FORMACIONES.map((f) => <option key={f}>{f}</option>)}
            </select></label>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary">Crear y abrir cancha</button>
        </div>
      </form>
    </div>
  );
}

// --- Constructor de cancha --------------------------------------------------
function Constructor({ id, onClose }) {
  const [plantilla, setPlantilla] = useState(null);
  const [elegibles, setElegibles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [seleccion, setSeleccion] = useState(null); // posicion seleccionada
  const [error, setError] = useState("");

  async function cargar() {
    try {
      const [pl, eleg] = await Promise.all([api(`/plantillas/${id}`), api(`/plantillas/${id}/elegibles`)]);
      setPlantilla(pl);
      setElegibles(eleg);
    } catch (err) { setError(err.message); }
  }
  useEffect(() => {
    cargar();
    api("/usuarios").then(setUsuarios).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function asignar(posId, jugadorId) {
    setError("");
    try {
      await api(`/plantillas/${id}/posiciones/${posId}`, { method: "PUT", body: { jugador_id: jugadorId } });
      setSeleccion(null);
      cargar();
    } catch (err) { setError(err.message); }
  }
  async function cambiarFormacion(formacion) {
    if (!confirm("Cambiar la formacion vacia las asignaciones actuales. Continuar?")) return;
    setError("");
    try {
      await api(`/plantillas/${id}/formacion`, { method: "PUT", body: { formacion } });
      cargar();
    } catch (err) { setError(err.message); }
  }

  if (!plantilla) return <div className="muted">Cargando cancha...</div>;

  const titulares = plantilla.posiciones.filter((p) => p.tipo === "TITULAR");
  const banca = plantilla.posiciones.filter((p) => p.tipo === "BANCA");
  const FORMACIONES = ["4-3-3", "4-4-2", "4-2-3-1", "3-5-2", "3-4-3", "5-3-2", "4-1-2-3"];

  return (
    <div>
      <div className="page-head">
        <div>
          <button className="btn btn-ghost" onClick={onClose}>← Volver</button>
          <h2 className="page-title" style={{ display: "inline", marginLeft: 8 }}>{plantilla.nombre}</h2>
        </div>
        <div className="builder-controls">
          <span className="muted">{plantilla.categoria_nombre} ({plantilla.anio_min}–{plantilla.anio_max})</span>
          <label className="field" style={{ minWidth: 120 }}>
            <span>Formacion</span>
            <select value={plantilla.formacion} onChange={(e) => cambiarFormacion(e.target.value)}>
              {FORMACIONES.map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="builder">
        {/* Cancha */}
        <div className="pitch">
          <div className="pitch-line-mid" />
          <div className="pitch-circle" />
          <div className="pitch-area pitch-area-top" />
          <div className="pitch-area pitch-area-bottom" />
          {titulares.map((p) => (
            <button
              key={p.id}
              className={`spot ${p.jugador_id ? "spot-filled" : "spot-empty"} ${p.foto_url ? "spot-foto" : ""} ${seleccion?.id === p.id ? "spot-active" : ""}`}
              style={{
                left: `${p.coord_x}%`,
                top: `${p.coord_y}%`,
                ...(p.foto_url ? { backgroundImage: `url(${p.foto_url})` } : {}),
              }}
              onClick={() => setSeleccion(p)}
              title={p.posicion}
            >
              <span className="spot-pos">{p.posicion}</span>
              <span className="spot-name">{p.jugador_id ? p.apellido : "Vacante"}</span>
            </button>
          ))}
        </div>

        {/* Panel lateral */}
        <aside className="builder-side">
          {seleccion ? (
            <div className="card">
              <h4>Posicion {seleccion.posicion} {seleccion.tipo === "BANCA" ? "(banca)" : ""}</h4>
              {seleccion.jugador_id && (
                <p>
                  Asignado: <strong>{seleccion.nombre} {seleccion.apellido}</strong>
                  <button className="btn btn-sm btn-danger" style={{ marginLeft: 8 }}
                    onClick={() => asignar(seleccion.id, null)}>Liberar</button>
                </p>
              )}
              <label className="field">
                <span>Asignar jugador elegible</span>
                <select defaultValue="" onChange={(e) => e.target.value && asignar(seleccion.id, Number(e.target.value))}>
                  <option value="" disabled>Selecciona...</option>
                  {elegibles.map((j) => (
                    <option key={j.id} value={j.id}>{j.apellido} {j.nombre} · {j.edad} anios</option>
                  ))}
                </select>
              </label>
              {elegibles.length === 0 && (
                <p className="muted">No hay jugadores elegibles (deben estar en el rango de anios de la categoria y sin mora).</p>
              )}
              <button className="btn btn-ghost btn-sm" onClick={() => setSeleccion(null)}>Cerrar</button>
            </div>
          ) : (
            <div className="card"><p className="muted">Haz clic en una casilla de la cancha o de la banca para asignar un jugador.</p></div>
          )}

          <CuerpoTecnico plantilla={plantilla} usuarios={usuarios} onChanged={cargar} />
        </aside>
      </div>

      {/* Banca */}
      <div className="bench">
        <h4>Banca</h4>
        <div className="bench-row">
          {banca.map((p) => (
            <button key={p.id}
              className={`bench-spot ${p.jugador_id ? "spot-filled" : "spot-empty"} ${seleccion?.id === p.id ? "spot-active" : ""}`}
              onClick={() => setSeleccion(p)}>
              {p.jugador_id ? `${p.apellido}` : "Vacante"}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function CuerpoTecnico({ plantilla, usuarios, onChanged }) {
  const [usuarioId, setUsuarioId] = useState("");
  const [rol, setRol] = useState("DT");
  const [error, setError] = useState("");
  const ROLES = ["DT", "ASISTENTE", "PF", "ARQUERO"];

  async function agregar() {
    if (!usuarioId) return;
    setError("");
    try {
      await api(`/plantillas/${plantilla.id}/cuerpo-tecnico`, { method: "POST", body: { usuario_id: Number(usuarioId), rol_tecnico: rol } });
      setUsuarioId("");
      onChanged();
    } catch (err) { setError(err.message); }
  }
  async function quitar(uid) {
    try {
      await api(`/plantillas/${plantilla.id}/cuerpo-tecnico/${uid}`, { method: "DELETE" });
      onChanged();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="card">
      <h4>Cuerpo tecnico</h4>
      {error && <div className="alert alert-error">{error}</div>}
      {plantilla.cuerpo_tecnico.length === 0 && <p className="muted">Sin cuerpo tecnico asignado.</p>}
      {plantilla.cuerpo_tecnico.map((c) => (
        <div key={c.id} className="vinculo-row">
          <strong>{c.nombre}</strong>
          <span className="badge badge-ok">{c.rol_tecnico}</span>
          <button className="btn btn-sm btn-danger" onClick={() => quitar(c.usuario_id)}>Quitar</button>
        </div>
      ))}
      <div className="tutor-picker" style={{ marginTop: 8 }}>
        <select value={usuarioId} onChange={(e) => setUsuarioId(e.target.value)}>
          <option value="">Usuario...</option>
          {usuarios.map((u) => <option key={u.id} value={u.id}>{u.nombre} ({u.rol})</option>)}
        </select>
        <select value={rol} onChange={(e) => setRol(e.target.value)}>
          {ROLES.map((r) => <option key={r}>{r}</option>)}
        </select>
        <button className="btn" onClick={agregar}>Agregar</button>
      </div>
    </div>
  );
}

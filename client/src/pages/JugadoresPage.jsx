import { useEffect, useRef, useState } from "react";
import { api, apiUpload } from "../api/client.js";
import Avatar from "../components/Avatar.jsx";

const TIPOS_DOC = ["TI", "RC", "CC", "CE", "PAS"];
const VACIO = {
  tipo_documento: "TI", numero_documento: "", nombre: "", apellido: "",
  fecha_nacimiento: "", genero: "", eps: "", contacto_emergencia: "", telefono_emergencia: "",
};

export default function JugadoresPage() {
  const [jugadores, setJugadores] = useState([]);
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [creando, setCreando] = useState(false);
  const [detalleId, setDetalleId] = useState(null);

  async function cargar() {
    setCargando(true);
    try {
      setJugadores(await api(`/jugadores${q ? `?q=${encodeURIComponent(q)}` : ""}`));
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

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Jugadores</h2>
        <button className="btn btn-primary" onClick={() => { setError(""); setCreando(true); }}>
          + Nuevo jugador
        </button>
      </div>

      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); cargar(); }}>
        <input placeholder="Buscar por nombre o documento..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">Buscar</button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="table-wrap"><table className="data-table">
        <thead>
          <tr><th>Documento</th><th>Nombre</th><th>Edad</th><th>Estado</th><th></th></tr>
        </thead>
        <tbody>
          {cargando && <tr><td colSpan={5} className="muted">Cargando...</td></tr>}
          {!cargando && jugadores.length === 0 && <tr><td colSpan={5} className="muted">Sin resultados.</td></tr>}
          {jugadores.map((j) => (
            <tr key={j.id}>
              <td>{j.tipo_documento} {j.numero_documento}</td>
              <td>
                <span className="cell-jugador">
                  <Avatar src={j.foto_url} nombre={j.nombre} apellido={j.apellido} size={30} />
                  {j.nombre} {j.apellido}
                </span>
              </td>
              <td>{j.edad} años</td>
              <td>{j.en_mora ? <span className="badge badge-danger">En mora</span> : <span className="badge badge-ok">Al dia</span>}</td>
              <td className="row-actions">
                <button className="btn btn-sm" onClick={() => setDetalleId(j.id)}>Ver / Editar</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      {creando && (
        <FormularioNuevo onClose={() => setCreando(false)} onSaved={() => { setCreando(false); cargar(); }} />
      )}
      {detalleId && (
        <DetalleJugador id={detalleId} onClose={() => setDetalleId(null)} onChanged={cargar} />
      )}
    </div>
  );
}

// --- Alta de jugador con seleccion de tutores ------------------------------
function FormularioNuevo({ onClose, onSaved }) {
  const [form, setForm] = useState({ ...VACIO });
  const [tutoresDisponibles, setTutoresDisponibles] = useState([]);
  const [vinculos, setVinculos] = useState([]); // { tutor_id, parentesco, es_principal }
  const [error, setError] = useState("");

  useEffect(() => {
    api("/tutores").then(setTutoresDisponibles).catch(() => {});
  }, []);

  function agregarTutor(tutorId) {
    if (!tutorId || vinculos.some((v) => v.tutor_id === Number(tutorId))) return;
    const esPrimero = vinculos.length === 0;
    setVinculos([...vinculos, { tutor_id: Number(tutorId), parentesco: "", es_principal: esPrimero }]);
  }
  function quitarTutor(tutorId) {
    setVinculos(vinculos.filter((v) => v.tutor_id !== tutorId));
  }
  function marcarPrincipal(tutorId) {
    setVinculos(vinculos.map((v) => ({ ...v, es_principal: v.tutor_id === tutorId })));
  }
  function setParentesco(tutorId, valor) {
    setVinculos(vinculos.map((v) => (v.tutor_id === tutorId ? { ...v, parentesco: valor } : v)));
  }

  const nombreTutor = (id) => {
    const t = tutoresDisponibles.find((x) => x.id === id);
    return t ? `${t.nombre} ${t.apellido}` : `#${id}`;
  };

  async function guardar(e) {
    e.preventDefault();
    setError("");
    try {
      await api("/jugadores", { method: "POST", body: { ...form, tutores: vinculos } });
      onSaved();
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <form className="modal modal-lg" onClick={(e) => e.stopPropagation()} onSubmit={guardar}>
        <h3>Nuevo jugador</h3>
        {error && <div className="alert alert-error">{error}</div>}

        <div className="form-grid">
          <label className="field">
            <span>Tipo doc.</span>
            <select value={form.tipo_documento} onChange={(e) => setForm({ ...form, tipo_documento: e.target.value })}>
              {TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}
            </select>
          </label>
          <label className="field"><span>Numero documento *</span>
            <input value={form.numero_documento} onChange={(e) => setForm({ ...form, numero_documento: e.target.value })} required /></label>
          <label className="field"><span>Nombre *</span>
            <input value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} required /></label>
          <label className="field"><span>Apellido *</span>
            <input value={form.apellido} onChange={(e) => setForm({ ...form, apellido: e.target.value })} required /></label>
          <label className="field"><span>Fecha nacimiento *</span>
            <input type="date" value={form.fecha_nacimiento} onChange={(e) => setForm({ ...form, fecha_nacimiento: e.target.value })} required /></label>
          <label className="field"><span>Genero</span>
            <select value={form.genero} onChange={(e) => setForm({ ...form, genero: e.target.value })}>
              <option value="">—</option><option value="M">M</option><option value="F">F</option><option value="O">O</option>
            </select></label>
          <label className="field"><span>EPS</span>
            <input value={form.eps} onChange={(e) => setForm({ ...form, eps: e.target.value })} /></label>
          <label className="field"><span>Contacto emergencia</span>
            <input value={form.contacto_emergencia} onChange={(e) => setForm({ ...form, contacto_emergencia: e.target.value })} /></label>
          <label className="field"><span>Tel. emergencia</span>
            <input value={form.telefono_emergencia} onChange={(e) => setForm({ ...form, telefono_emergencia: e.target.value })} /></label>
        </div>

        <div className="subsection">
          <h4>Tutores (al menos uno, marca el principal)</h4>
          <div className="tutor-picker">
            <select id="sel-tutor" defaultValue="">
              <option value="" disabled>Selecciona un tutor...</option>
              {tutoresDisponibles.map((t) => (
                <option key={t.id} value={t.id}>{t.nombre} {t.apellido} — {t.numero_documento}</option>
              ))}
            </select>
            <button type="button" className="btn" onClick={() => {
              const sel = document.getElementById("sel-tutor");
              agregarTutor(sel.value); sel.value = "";
            }}>Agregar</button>
          </div>

          {vinculos.length === 0 && <p className="muted">Aun no has agregado tutores.</p>}
          {vinculos.map((v) => (
            <div key={v.tutor_id} className="vinculo-row">
              <strong>{nombreTutor(v.tutor_id)}</strong>
              <input className="parentesco" placeholder="Parentesco" value={v.parentesco}
                onChange={(e) => setParentesco(v.tutor_id, e.target.value)} />
              <label className="radio">
                <input type="radio" name="principal" checked={v.es_principal} onChange={() => marcarPrincipal(v.tutor_id)} />
                Principal
              </label>
              <button type="button" className="btn btn-sm btn-danger" onClick={() => quitarTutor(v.tutor_id)}>Quitar</button>
            </div>
          ))}
          {tutoresDisponibles.length === 0 && (
            <p className="alert alert-warn">No hay tutores registrados. Crea primero un tutor en el modulo Tutores.</p>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary">Crear jugador</button>
        </div>
      </form>
    </div>
  );
}

// --- Detalle / edicion del jugador + gestion de tutores --------------------
function DetalleJugador({ id, onClose, onChanged }) {
  const [jug, setJug] = useState(null);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(false);
  const [tutoresDisponibles, setTutoresDisponibles] = useState([]);
  const [nuevoTutor, setNuevoTutor] = useState("");
  const [nuevoParentesco, setNuevoParentesco] = useState("");
  const [subiendo, setSubiendo] = useState(false);
  const fileRef = useRef(null);

  async function cargar() {
    try {
      setJug(await api(`/jugadores/${id}`));
    } catch (err) {
      setError(err.message);
    }
  }
  useEffect(() => {
    cargar();
    api("/tutores").then(setTutoresDisponibles).catch(() => {});
    /* eslint-disable-next-line */
  }, [id]);

  async function onSubirFoto(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    setSubiendo(true);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      await apiUpload(`/jugadores/${id}/foto`, fd);
      await cargar();
      onChanged?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubiendo(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }
  async function quitarFoto() {
    if (!confirm("Quitar la foto del jugador?")) return;
    setError("");
    try {
      await api(`/jugadores/${id}/foto`, { method: "DELETE" });
      await cargar();
      onChanged?.();
    } catch (err) { setError(err.message); }
  }

  async function agregarTutor() {
    if (!nuevoTutor) return;
    setError("");
    try {
      await api(`/jugadores/${id}/tutores`, {
        method: "POST",
        body: { tutor_id: Number(nuevoTutor), parentesco: nuevoParentesco || null },
      });
      setNuevoTutor("");
      setNuevoParentesco("");
      cargar();
      onChanged?.();
    } catch (err) { setError(err.message); }
  }

  async function hacerPrincipal(tutorId) {
    setError("");
    try {
      await api(`/jugadores/${id}/tutor-principal`, { method: "PUT", body: { tutor_id: tutorId } });
      cargar();
    } catch (err) { setError(err.message); }
  }
  async function quitarTutor(tutorId) {
    setError("");
    try {
      await api(`/jugadores/${id}/tutores/${tutorId}`, { method: "DELETE" });
      cargar();
    } catch (err) { setError(err.message); }
  }
  async function guardarEdicion(e) {
    e.preventDefault();
    setError("");
    try {
      await api(`/jugadores/${id}`, { method: "PUT", body: jug });
      setEditando(false);
      cargar();
      onChanged?.();
    } catch (err) { setError(err.message); }
  }
  async function desactivar() {
    if (!confirm("Desactivar a este jugador?")) return;
    try {
      await api(`/jugadores/${id}`, { method: "DELETE" });
      onChanged?.();
      onClose();
    } catch (err) { setError(err.message); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        {!jug ? (
          <p className="muted">Cargando...</p>
        ) : (
          <>
            <div className="detalle-cabecera">
              <Avatar src={jug.foto_url} nombre={jug.nombre} apellido={jug.apellido} size={76} />
              <div>
                <h3>
                  {jug.nombre} {jug.apellido}{" "}
                  {jug.en_mora && <span className="badge badge-danger">En mora</span>}
                </h3>
                <input type="file" accept="image/*" ref={fileRef} style={{ display: "none" }} onChange={onSubirFoto} />
                <div className="foto-acciones">
                  <button className="btn btn-sm" onClick={() => fileRef.current?.click()} disabled={subiendo}>
                    {subiendo ? "Subiendo..." : jug.foto_url ? "Cambiar foto" : "Subir foto"}
                  </button>
                  {jug.foto_url && <button className="btn btn-sm btn-danger" onClick={quitarFoto}>Quitar foto</button>}
                </div>
              </div>
            </div>
            {error && <div className="alert alert-error">{error}</div>}

            {!editando ? (
              <div className="detalle-grid">
                <div><span className="muted">Documento</span><div>{jug.tipo_documento} {jug.numero_documento}</div></div>
                <div><span className="muted">Edad</span><div>{jug.edad} años</div></div>
                <div><span className="muted">Fecha nacimiento</span><div>{String(jug.fecha_nacimiento).slice(0, 10)}</div></div>
                <div><span className="muted">Genero</span><div>{jug.genero || "—"}</div></div>
                <div><span className="muted">EPS</span><div>{jug.eps || "—"}</div></div>
                <div><span className="muted">Contacto emergencia</span><div>{jug.contacto_emergencia || "—"} {jug.telefono_emergencia || ""}</div></div>
              </div>
            ) : (
              <form className="form-grid" onSubmit={guardarEdicion}>
                <label className="field"><span>Nombre</span>
                  <input value={jug.nombre} onChange={(e) => setJug({ ...jug, nombre: e.target.value })} required /></label>
                <label className="field"><span>Apellido</span>
                  <input value={jug.apellido} onChange={(e) => setJug({ ...jug, apellido: e.target.value })} required /></label>
                <label className="field"><span>Documento</span>
                  <input value={jug.numero_documento} onChange={(e) => setJug({ ...jug, numero_documento: e.target.value })} required /></label>
                <label className="field"><span>Fecha nacimiento</span>
                  <input type="date" value={String(jug.fecha_nacimiento).slice(0, 10)} onChange={(e) => setJug({ ...jug, fecha_nacimiento: e.target.value })} required /></label>
                <label className="field"><span>EPS</span>
                  <input value={jug.eps || ""} onChange={(e) => setJug({ ...jug, eps: e.target.value })} /></label>
                <label className="field"><span>Contacto emergencia</span>
                  <input value={jug.contacto_emergencia || ""} onChange={(e) => setJug({ ...jug, contacto_emergencia: e.target.value })} /></label>
                <div className="modal-actions field-wide">
                  <button type="button" className="btn btn-ghost" onClick={() => setEditando(false)}>Cancelar</button>
                  <button className="btn btn-primary">Guardar cambios</button>
                </div>
              </form>
            )}

            <div className="subsection">
              <h4>Tutores</h4>
              {jug.tutores.map((t) => (
                <div key={t.tutor_id} className="vinculo-row">
                  <strong>{t.nombre} {t.apellido}</strong>
                  <span className="muted">{t.parentesco || "—"}</span>
                  {t.es_principal ? (
                    <span className="badge badge-ok">Principal</span>
                  ) : (
                    <button className="btn btn-sm" onClick={() => hacerPrincipal(t.tutor_id)}>Hacer principal</button>
                  )}
                  <span className="muted">{t.telefono || ""}</span>
                  {!t.es_principal && (
                    <button className="btn btn-sm btn-danger" onClick={() => quitarTutor(t.tutor_id)}>Quitar</button>
                  )}
                </div>
              ))}

              {/* Agregar un tutor existente al jugador */}
              {(() => {
                const yaVinculados = new Set(jug.tutores.map((t) => t.tutor_id));
                const disponibles = tutoresDisponibles.filter((t) => !yaVinculados.has(t.id));
                if (disponibles.length === 0) {
                  return <p className="muted" style={{ marginTop: 10 }}>No hay mas tutores para agregar. Crea uno nuevo en el modulo Tutores.</p>;
                }
                return (
                  <div className="tutor-picker" style={{ marginTop: 12 }}>
                    <select value={nuevoTutor} onChange={(e) => setNuevoTutor(e.target.value)}>
                      <option value="">Agregar tutor existente...</option>
                      {disponibles.map((t) => (
                        <option key={t.id} value={t.id}>{t.nombre} {t.apellido} — {t.numero_documento}</option>
                      ))}
                    </select>
                    <input className="parentesco" placeholder="Parentesco" value={nuevoParentesco}
                      onChange={(e) => setNuevoParentesco(e.target.value)} />
                    <button type="button" className="btn" onClick={agregarTutor} disabled={!nuevoTutor}>Agregar</button>
                  </div>
                );
              })()}
            </div>

            {!editando && (
              <div className="modal-actions">
                <button className="btn btn-danger" onClick={desactivar}>Desactivar</button>
                <button className="btn" onClick={() => setEditando(true)}>Editar datos</button>
                <button className="btn btn-ghost" onClick={onClose}>Cerrar</button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

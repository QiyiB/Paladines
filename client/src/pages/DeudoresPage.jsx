import { useEffect, useState } from "react";
import { api } from "../api/client.js";
import { money } from "./ConceptosPage.jsx";

export default function DeudoresPage() {
  const [deudores, setDeudores] = useState([]);
  const [q, setQ] = useState("");
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");

  async function cargar() {
    setCargando(true);
    try {
      setDeudores(await api(`/deudores${q ? `?q=${encodeURIComponent(q)}` : ""}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }
  useEffect(() => { cargar(); /* eslint-disable-next-line */ }, []);

  const totalGeneral = deudores.reduce((acc, d) => acc + Number(d.total), 0);

  return (
    <div>
      <div className="page-head">
        <h2 className="page-title">Deudores</h2>
        <span className="badge badge-danger">{deudores.length} jugador(es) · {money(totalGeneral)}</span>
      </div>
      <p className="muted">Jugadores con deudas exigibles (vencidas o sin vencimiento, como la inscripcion).</p>

      <form className="search-bar" onSubmit={(e) => { e.preventDefault(); cargar(); }}>
        <input placeholder="Buscar por nombre o documento..." value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn">Buscar</button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {cargando && <p className="muted">Cargando...</p>}
      {!cargando && deudores.length === 0 && <div className="card"><p className="muted">No hay deudores. 🎉</p></div>}

      {deudores.map((d) => (
        <div key={d.jugador_id} className="card">
          <div className="page-head" style={{ marginBottom: 8 }}>
            <h3 style={{ margin: 0 }}>{d.apellido} {d.nombre} <span className="muted">· {d.tipo_documento} {d.numero_documento}</span></h3>
            <span className="badge badge-danger">{money(d.total)}</span>
          </div>
          <div className="table-wrap"><table className="data-table">
            <thead><tr><th>Concepto</th><th>Monto</th><th>Generada</th><th>Vencimiento</th></tr></thead>
            <tbody>
              {d.deudas.map((x, i) => (
                <tr key={i}>
                  <td>{x.concepto}</td>
                  <td>{money(x.monto)}</td>
                  <td>{String(x.fecha_generada).slice(0, 10)}</td>
                  <td>{x.fecha_vencimiento ? String(x.fecha_vencimiento).slice(0, 10) : "Inmediata"}</td>
                </tr>
              ))}
            </tbody>
          </table></div>
        </div>
      ))}
    </div>
  );
}

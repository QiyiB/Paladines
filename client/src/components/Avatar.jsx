// Avatar de jugador: muestra la foto si existe; si no, un circulo con iniciales.
export default function Avatar({ src, nombre = "", apellido = "", size = 64 }) {
  const iniciales = `${(nombre[0] || "")}${(apellido[0] || "")}`.toUpperCase() || "?";

  if (src) {
    return (
      <img
        src={src}
        alt={`Foto de ${nombre} ${apellido}`.trim()}
        className="avatar-img"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div className="avatar-iniciales" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {iniciales}
    </div>
  );
}

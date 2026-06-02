import { useState } from "react";

// Logo de Paladines.
// Usa la imagen real en client/public/logo.png si existe; si no la encuentra,
// cae automaticamente al escudo placeholder (asi nada se rompe).
// Para cambiar el logo: guarda tu archivo como  client/public/logo.png
// (PNG con fondo transparente recomendado). Si tu archivo es .svg, cambia
// la constante LOGO_SRC de abajo a "/logo.svg".
const LOGO_SRC = "/logo.png";

export default function Logo({ size = 40 }) {
  const [falla, setFalla] = useState(false);

  if (!falla) {
    return (
      <img
        src={LOGO_SRC}
        alt="Logo Paladines"
        onError={() => setFalla(true)}
        style={{ height: size, width: "auto", maxWidth: size * 2, objectFit: "contain", display: "block" }}
      />
    );
  }

  // Fallback: escudo placeholder (se muestra si aun no agregaste tu logo).
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="Escudo Paladines"
    >
      <path
        d="M32 4 L56 12 V30 C56 46 45 56 32 60 C19 56 8 46 8 30 V12 Z"
        fill="#0e2a47"
        stroke="#f5b301"
        strokeWidth="2.5"
      />
      <path
        d="M24 22 h16 a4 4 0 0 1 4 4 v6 a12 12 0 0 1 -24 0 v-6 a4 4 0 0 1 4 -4 Z"
        fill="#f5b301"
      />
      <rect x="30" y="20" width="4" height="6" rx="1" fill="#f5b301" />
      <rect x="22" y="30" width="20" height="3" fill="#0e2a47" />
      <circle cx="32" cy="46" r="6" fill="#ffffff" stroke="#0e2a47" strokeWidth="1.5" />
      <path d="M32 42 l2.5 2 -1 3 h-3 l-1 -3 Z" fill="#0e2a47" />
    </svg>
  );
}

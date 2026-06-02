// Genera las casillas de la cancha a partir de una formacion como "4-3-3".
// La suma de las lineas debe ser 10 (jugadores de campo) + 1 portero = 11.
// Coordenadas en 0-100: coord_y crece hacia la porteria propia (portero abajo).

export function parseFormacion(formacion) {
  if (typeof formacion !== "string") return null;
  const partes = formacion.split("-").map((s) => parseInt(s.trim(), 10));
  if (partes.length < 2 || partes.some((n) => !Number.isInteger(n) || n <= 0)) return null;
  const suma = partes.reduce((a, b) => a + b, 0);
  if (suma !== 10) return null;
  return partes;
}

export function generarPosiciones(formacion) {
  const partes = parseFormacion(formacion);
  if (!partes) return null;

  const posiciones = [];
  let orden = 1;

  // Portero
  posiciones.push({ posicion: "POR", tipo: "TITULAR", orden: orden++, coord_x: 50, coord_y: 90 });

  const lineas = partes.length;
  partes.forEach((cantidad, i) => {
    const y = lineas === 1 ? 50 : Math.round(74 - i * (60 / (lineas - 1)));
    const etiqueta = i === 0 ? "DEF" : i === lineas - 1 ? "DEL" : "MED";
    for (let j = 0; j < cantidad; j++) {
      const x = Math.round(((j + 1) * 100) / (cantidad + 1));
      posiciones.push({ posicion: etiqueta, tipo: "TITULAR", orden: orden++, coord_x: x, coord_y: y });
    }
  });

  // Banca (5 casillas)
  for (let b = 0; b < 5; b++) {
    posiciones.push({ posicion: "BANCA", tipo: "BANCA", orden: orden++, coord_x: null, coord_y: null });
  }

  return posiciones;
}

// Paleta de la marca (RGB para jsPDF)
const NAVY = [14, 42, 71];
const GOLD = [245, 179, 1];
const GOLD_TEXT = [161, 122, 7];
const TEXT = [22, 32, 43];
const MUTED = [104, 117, 133];
const BORDER = [224, 230, 240];
const LIGHT = [246, 248, 251];
const GOLD_SOFT = [255, 246, 222];

const COP = (n) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n || 0));

function fechaCorta(s) {
  if (!s) return "—";
  const d = new Date(String(s).length <= 10 ? `${s}T00:00:00` : s);
  if (isNaN(d)) return String(s).slice(0, 10);
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "2-digit", year: "numeric" });
}

const bonito = (m) => (m ? m.charAt(0) + m.slice(1).toLowerCase() : "—");

// Carga el logo desde /logo.png como dataURL + dimensiones (para mantener proporcion).
async function cargarLogo() {
  try {
    const res = await fetch("/logo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
    const dims = await new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve(null);
      img.src = dataUrl;
    });
    return { dataUrl, dims };
  } catch {
    return null;
  }
}

// Genera y descarga un recibo de pago en PDF (A5) con la estetica del club.
// data: { id, fecha_pago, fecha_expiracion, monto, metodo,
//         jugador_nombre, jugador_apellido, numero_documento, concepto, registrado_por }
export async function generarReciboPDF(data) {
  // Carga jsPDF solo al generar el recibo (no pesa en la carga inicial de la app).
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a5" }); // 148 x 210 mm
  const logo = await cargarLogo();
  const num = String(data.id ?? "").padStart(4, "0");

  const fill = (c) => doc.setFillColor(c[0], c[1], c[2]);
  const stroke = (c) => doc.setDrawColor(c[0], c[1], c[2]);
  const color = (c) => doc.setTextColor(c[0], c[1], c[2]);

  // Marco suave de la "tarjeta"
  stroke(BORDER);
  doc.setLineWidth(0.4);
  doc.roundedRect(7, 7, 134, 196, 5, 5, "S");

  // ---- Encabezado: logo + nombre del club + tipo de documento ----
  let titleX = 14;
  if (logo) {
    const box = 22;
    let lw = box, lh = box;
    if (logo.dims) {
      const r = logo.dims.w / logo.dims.h;
      if (r > 1) lh = box / r; else lw = box * r;
    }
    doc.addImage(logo.dataUrl, "PNG", 14, 13 + (box - lh) / 2, lw, lh);
    titleX = 14 + box + 6;
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  color(NAVY);
  doc.setCharSpace(0.6);
  doc.text("PALADINES", titleX, 22);
  doc.setCharSpace(0);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  color(GOLD_TEXT);
  doc.text("Corporacion · Escuela de Futbol", titleX, 28);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  color(NAVY);
  doc.text("RECIBO DE PAGO", 134, 17, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  color(MUTED);
  doc.text(`N.º ${num}`, 134, 22.5, { align: "right" });

  // Linea dorada
  fill(GOLD);
  doc.roundedRect(14, 34, 120, 1.3, 0.6, 0.6, "F");

  // ---- Recibido de (izq) + Fecha (der) ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  color(MUTED);
  doc.setCharSpace(0.5);
  doc.text("RECIBIDO DE", 14, 45);
  doc.text("FECHA DE PAGO", 134, 45, { align: "right" });
  doc.setCharSpace(0);

  const nombre = `${data.jugador_nombre || ""} ${data.jugador_apellido || ""}`.trim() || "—";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(nombre.length > 26 ? 11 : 13);
  color(TEXT);
  doc.text(nombre, 14, 52);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  color(MUTED);
  doc.text(`Documento: ${data.numero_documento || "—"}`, 14, 57.5);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  color(NAVY);
  doc.text(fechaCorta(data.fecha_pago), 134, 52, { align: "right" });

  // ---- Caja de detalles ----
  fill(LIGHT);
  stroke(BORDER);
  doc.setLineWidth(0.3);
  doc.roundedRect(14, 66, 120, 34, 3, 3, "FD");

  const fila = (label, value, y) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9.5);
    color(MUTED);
    doc.text(label, 20, y);
    doc.setFont("helvetica", "bold");
    color(TEXT);
    doc.text(String(value), 128, y, { align: "right" });
  };
  fila("Concepto", data.concepto || "—", 75);
  fila("Metodo de pago", bonito(data.metodo), 85);
  fila("Vigencia / Expira", data.fecha_expiracion ? fechaCorta(data.fecha_expiracion) : "No expira", 95);

  stroke(BORDER);
  doc.setLineWidth(0.2);
  doc.line(20, 80, 128, 80);
  doc.line(20, 90, 128, 90);

  // ---- Caja del monto (acento dorado) ----
  fill(GOLD_SOFT);
  doc.roundedRect(14, 106, 120, 26, 3, 3, "F");
  fill(GOLD);
  doc.roundedRect(14, 106, 2.6, 26, 1.3, 1.3, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  color(NAVY);
  doc.setCharSpace(0.5);
  doc.text("MONTO PAGADO", 22, 116);
  doc.setCharSpace(0);
  doc.setFontSize(23);
  doc.text(COP(data.monto), 130, 123, { align: "right" });

  // ---- Pie ----
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  color(MUTED);
  doc.text(`Registrado por: ${data.registrado_por || "—"}`, 14, 146);

  stroke(BORDER);
  doc.setLineWidth(0.3);
  doc.line(14, 152, 134, 152);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  color(NAVY);
  doc.text("¡Gracias por tu pago!", 14, 160);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  color(MUTED);
  doc.text("Este recibo certifica el pago registrado en la plataforma Paladines.", 14, 165.5, { maxWidth: 120 });

  doc.setFontSize(7.5);
  color(MUTED);
  doc.text(`Generado el ${fechaCorta(new Date().toISOString())} · Recibo N.º ${num}`, 74, 196, { align: "center" });

  doc.save(`recibo-paladines-${num}.pdf`);
}

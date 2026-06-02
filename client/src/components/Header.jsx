import Logo from "./Logo.jsx";
import AccountMenu from "./AccountMenu.jsx";

// Header de la aplicacion. Incluye el logo de Paladines (requisito) y, en movil,
// el boton que abre el cajon de navegacion.
export default function Header({ onMenu }) {
  return (
    <header className="app-header">
      <div className="brand">
        <button className="menu-btn" onClick={onMenu} aria-label="Abrir menu">☰</button>
        <Logo size={40} />
        <div className="brand-text">
          <span className="brand-name">PALADINES</span>
          <span className="brand-sub">Escuela de Futbol</span>
        </div>
      </div>

      <AccountMenu variant="header" />
    </header>
  );
}

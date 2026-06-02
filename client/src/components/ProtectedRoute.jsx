import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

// Protege rutas: exige sesion y, opcionalmente, un rol concreto.
export default function ProtectedRoute({ children, rol }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <div className="center-screen">Cargando...</div>;
  if (!usuario) return <Navigate to="/login" replace state={{ from: location }} />;
  if (rol && usuario.rol !== rol) return <Navigate to="/" replace />;

  return children;
}

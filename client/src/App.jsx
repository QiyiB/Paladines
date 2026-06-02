import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext.jsx";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import Layout from "./components/Layout.jsx";
import LoginPage from "./pages/LoginPage.jsx";
import DashboardPage from "./pages/DashboardPage.jsx";
import JugadoresPage from "./pages/JugadoresPage.jsx";
import TutoresPage from "./pages/TutoresPage.jsx";
import CategoriasPage from "./pages/CategoriasPage.jsx";
import PlantillasPage from "./pages/PlantillasPage.jsx";
import SesionesPage from "./pages/SesionesPage.jsx";
import UsuariosPage from "./pages/UsuariosPage.jsx";
import ConceptosPage from "./pages/ConceptosPage.jsx";
import PagosPage from "./pages/PagosPage.jsx";
import DeudoresPage from "./pages/DeudoresPage.jsx";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            element={
              <ProtectedRoute>
                <Layout />
              </ProtectedRoute>
            }
          >
            <Route index element={<DashboardPage />} />
            <Route path="jugadores" element={<JugadoresPage />} />
            <Route path="tutores" element={<TutoresPage />} />
            <Route path="categorias" element={<CategoriasPage />} />
            <Route path="plantillas" element={<PlantillasPage />} />
            <Route path="sesiones" element={<SesionesPage />} />
            <Route path="usuarios" element={<ProtectedRoute rol="ADMIN"><UsuariosPage /></ProtectedRoute>} />
            <Route path="conceptos" element={<ProtectedRoute rol="ADMIN"><ConceptosPage /></ProtectedRoute>} />
            <Route path="pagos" element={<ProtectedRoute rol="ADMIN"><PagosPage /></ProtectedRoute>} />
            <Route path="deudores" element={<ProtectedRoute rol="ADMIN"><DeudoresPage /></ProtectedRoute>} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

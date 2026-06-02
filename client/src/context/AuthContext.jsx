import { createContext, useContext, useEffect, useState } from "react";
import { api, getToken, setToken } from "../api/client.js";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);

  // Al montar, si hay token guardado intentamos recuperar la sesion.
  useEffect(() => {
    (async () => {
      if (!getToken()) {
        setCargando(false);
        return;
      }
      try {
        const { usuario } = await api("/auth/me");
        setUsuario(usuario);
      } catch {
        setToken(null);
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  async function login(email, password) {
    const { token, usuario } = await api("/auth/login", {
      method: "POST",
      body: { email, password },
      auth: false,
    });
    setToken(token);
    setUsuario(usuario);
    return usuario;
  }

  function logout() {
    setToken(null);
    setUsuario(null);
  }

  const esAdmin = usuario?.rol === "ADMIN";

  return (
    <AuthContext.Provider value={{ usuario, setUsuario, cargando, login, logout, esAdmin }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return ctx;
}

// Cliente HTTP minimo. Adjunta el token JWT y centraliza el manejo de errores.

const TOKEN_KEY = "paladines_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}
export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

export async function api(path, { method = "GET", body, auth = true } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const token = getToken();
  if (auth && token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`/api${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // 401 -> sesion invalida: limpiamos el token.
  if (res.status === 401) {
    setToken(null);
  }

  let data = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Error ${res.status}`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

// Subida de archivos (multipart). No se fija Content-Type: el navegador pone
// el boundary correcto al pasar un FormData.
export async function apiUpload(path, formData, { method = "POST" } = {}) {
  const token = getToken();
  const res = await fetch(`/api${path}`, {
    method,
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });
  if (res.status === 401) setToken(null);

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const err = new Error((data && data.error) || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

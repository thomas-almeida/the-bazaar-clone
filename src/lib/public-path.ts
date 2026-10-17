// Normalização de caminhos servidos a partir de /public (ou URLs HTTPS).
// Compartilhada entre a validação de arte e a de som no painel administrativo.
// Sem "use client" e sem "server-only": é função pura, usada nos dois lados.

// Aceita caminho público ("/sounds/ui/buy.mp3", "card-art/x.png"), caminho
// absoluto de arquivo local ("C:\repo\public\sounds\ui\buy.mp3") ou URL HTTPS.
// Rejeita traversal (".."), credenciais embutidas, barras invertidas,
// caracteres de controle e qualquer esquema que não seja https.
export function normalizePublicPath(src: string): string | null {
  const trimmed = src.trim();
  if (/^https:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      return !url.username && !url.password ? trimmed : null;
    } catch {
      return null;
    }
  }
  if (/^file:/i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      if (url.protocol === "file:") {
        const publicPath = decodeURIComponent(url.pathname).replace(/\\/g, "/");
        const publicMarker = publicPath.toLowerCase().lastIndexOf("/public/");
        if (publicMarker >= 0) return normalizePublicPath(publicPath.slice(publicMarker + "/public".length));
      }
    } catch {
      return null;
    }
    return null;
  }

  let normalized = trimmed.replace(/\\/g, "/");
  const publicMarker = normalized.toLowerCase().lastIndexOf("/public/");
  if (publicMarker >= 0) normalized = normalized.slice(publicMarker + "/public".length);
  else if (/^[a-z]:\//i.test(normalized)) return null;
  if (/^[a-z][a-z0-9+.-]*:/i.test(normalized)) return null;
  if (!normalized || normalized.startsWith("//")) return null;
  const publicPath = normalized.startsWith("/") ? normalized : `/${normalized}`;
  if (/[?#:\u0000-\u001f]/.test(publicPath)) return null;

  const segments = publicPath.slice(1).split("/");
  if (segments.some((segment) => !segment)) return null;
  for (const segment of segments) {
    let decoded: string;
    try {
      decoded = decodeURIComponent(segment);
    } catch {
      return null;
    }
    if (
      decoded === "." ||
      decoded === ".." ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      /[\u0000-\u001f]/.test(decoded)
    ) return null;
  }
  return publicPath;
}

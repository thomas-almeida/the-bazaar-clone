// Guarda de build: aborta `npm run build` se houver um `next dev` rodando.
//
// Motivo: build de produção e dev server escrevem no MESMO diretório `.next`.
// Rodar os dois ao mesmo tempo corrompe o cache do webpack e derruba o dev
// server com "Expected clientReferenceManifest to be defined" ou
// "Cannot find module './611.js'". Já aconteceu várias vezes aqui.
//
// Escape: MAGGI_SKIP_DEV_CHECK=1 npm run build

import { execFileSync } from "node:child_process";

const FORCE = process.env.MAGGI_SKIP_DEV_CHECK === "1";

function devServers() {
  try {
    if (process.platform === "win32") {
      const ps =
        "Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" " +
        "| Where-Object { $_.CommandLine -match 'next' } " +
        "| ForEach-Object { \"$($_.ProcessId)`t$($_.CommandLine)\" }";
      const out = execFileSync("powershell", ["-NoProfile", "-Command", ps], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      return out
        .split(/\r?\n/)
        .map((line) => line.split("\t"))
        .filter(([pid, cmd]) => pid && /next[\s\\]+(dist[\\/]bin[\\/])?next.*\bdev\b/.test(cmd))
        .map(([pid, cmd]) => ({ pid, cmd: cmd.trim() }));
    }
    const out = execFileSync("ps", ["-eo", "pid,args"], { encoding: "utf8" });
    return out
      .split("\n")
      .slice(1)
      .map((line) => line.trim().split(/\s+/))
      .filter(([pid, ...rest]) => /^\d+$/.test(pid) && rest.join(" ").includes("next") && /\bdev\b/.test(rest.join(" ")))
      .map(([pid, ...rest]) => ({ pid, cmd: rest.join(" ") }));
  } catch {
    // Se não der para inspecionar, não bloqueia o build.
    return [];
  }
}

const found = devServers();

if (found.length === 0) {
  console.log("check:dev — nenhum dev server rodando, build liberado.");
  process.exit(0);
}

if (FORCE) {
  console.warn("check:dev — MAGGI_SKIP_DEV_CHECK=1: buildando mesmo com dev server rodando.");
  process.exit(0);
}

console.error("\n  Build cancelado: existe um dev server rodando neste projeto.\n");
for (const { pid } of found) console.error(`    PID ${pid}`);
console.error(
  [
    "",
    "  Build e dev server dividem o .next e se corrompem quando rodam juntos.",
    "  Pare o dev server (Ctrl+C) e rode o build de novo.",
    "",
    "  Se você realmente quiser os dois ao mesmo tempo, use um distDir",
    "  separado em next.config — não é seguro compartilhar esta cópia.",
    "",
    "  Para forçar mesmo assim:  MAGGI_SKIP_DEV_CHECK=1 npm run build",
    "",
  ].join("\n"),
);
process.exit(1);

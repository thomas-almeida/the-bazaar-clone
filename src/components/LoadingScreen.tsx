"use client";

// Tela de carregamento: o logo começa cinzento e vai "colorindo" de baixo para
// cima, em loop, enquanto a tela de verdade carrega. Quando o conteúdo fica
// pronto, quem renderiza troca por ele (o loader some num fade — ver .is-leaving
// quando usado com saída controlada).

export default function LoadingScreen({
  label = "Carregando…",
  leaving = false,
}: {
  label?: string;
  leaving?: boolean;
}) {
  return (
    <div className={`loading-screen-v2 ${leaving ? "is-leaving" : ""}`} role="status" aria-live="polite">
      <div className="loading-logo" aria-hidden="true">
        {/* Base cinzenta + cópia colorida revelada de baixo para cima (loop). */}
        <img className="loading-logo-gray" src="/boargame/img/logo-game.png" alt="" />
        <img className="loading-logo-color" src="/boargame/img/logo-game.png" alt="" />
      </div>
      <p className="loading-label">{label}</p>
    </div>
  );
}

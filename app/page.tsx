import Link from "next/link";
import AppBackground from "@/components/AppBackground";

// Home screen: fundo em vídeo, menu alinhado à esquerda (estilo Marathon) e o
// título MAGGI em fonte display, à direita, no mesmo alinhamento dos botões.

export default function Home() {
  return (
    <main className="home">
      <AppBackground />

      <nav className="home-menu" aria-label="Menu principal">
        <Link href="/play" className="home-item home-item--play">
          <span className="home-item-label">JOGAR</span>
          <span className="home-item-sub">escolher mago</span>
        </Link>
        <Link href="/play" className="home-item home-item--play">
          <span className="home-item-label">APRENDER MAGGI</span>
          <span className="home-item-sub">Aprenda o básico</span>
        </Link>
        <Link href="/magos" className="home-item">
          <span className="home-item-label">MAGOS</span>
          <span className="home-item-tag">3</span>
        </Link>
        <Link href="/admin" className="home-item">
          <span className="home-item-label">BALANCEAMENTO</span>
          <span className="home-item-tag">ADMIN</span>
        </Link>
        <button className="home-item is-disabled" type="button" disabled aria-disabled="true">
          <span className="home-item-label">LÍDERES</span>
          <span className="home-item-tag">EM BREVE</span>
        </button>
        <button className="home-item is-disabled" type="button" disabled aria-disabled="true">
          <span className="home-item-label">RANQUEADA</span>
          <span className="home-item-tag">EM BREVE</span>
        </button>
      </nav>

      <div className="home-title-side">
        <img className="home-logo" src="/boargame/img/logo-game.png" alt="MAGGI" />
        <p className="home-version">ALFA 001 · VERSÃO DE TESTE</p>
      </div>

      <footer className="home-footer">MAGGI / TEMPORADA 1</footer>
    </main>
  );
}

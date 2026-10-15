// Fundo compartilhado (vídeo + overlay) usado na home, na página de magos e na
// batalha, para manter o design conciso. Fica atrás de tudo (z-index negativo).

export default function AppBackground() {
  return (
    <>
      <video
        className="app-bg"
        src="/boargame/img/bg-video-homescreen.mp4"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        aria-hidden="true"
      />
      <div className="app-bg-overlay" aria-hidden="true" />
    </>
  );
}

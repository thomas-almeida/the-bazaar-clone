// Regressão: a interface do tutorial tem que ser a MESMA do menu — sem inventar
// UI própria. Ou seja, o balão de dica reusa as classes do painel do menu
// (`.fullscreen-prompt-panel`, `.fullscreen-prompt-eyebrow`, `h2`,
// `.fullscreen-prompt-copy`) e os botões são `.home-item`, como em todas as
// outras telas. Classes "inventadas" (bolha/título/botão próprios) são proibidas.

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import TutorialOverlay from "../TutorialOverlay";

vi.mock("@/components/AuthProvider", () => ({
  useAuth: () => ({ markTutorialDone: vi.fn() }),
}));

beforeEach(() => {
  // Ativa o modo tutorial (lido de window.location.search no mount).
  window.history.replaceState(null, "", "/play?tutorial=1");
});

describe("TutorialOverlay: UI idêntica à do menu", () => {
  it("usa o painel do menu, não um balão inventado", () => {
    const { container } = render(<TutorialOverlay />);

    // Reaproveita o painel/typografia do menu.
    expect(container.querySelector(".fullscreen-prompt-panel"), "deve reusar o painel do menu").toBeTruthy();
    expect(container.querySelector(".fullscreen-prompt-eyebrow"), "deve reusar o eyebrow do menu").toBeTruthy();
    expect(container.querySelector("h2"), "título é <h2> como no menu").toBeTruthy();
    expect(container.querySelector(".fullscreen-prompt-copy"), "corpo reusa a copy do menu").toBeTruthy();

    // Classes inventadas não podem existir.
    for (const banido of [
      ".tutorial-bubble",
      ".tutorial-title",
      ".tutorial-body",
      ".tutorial-next",
      ".tutorial-step-count",
    ]) {
      expect(container.querySelector(banido), `classe inventada proibida: ${banido}`).toBeNull();
    }
  });

  it("os botões são .home-item, como no menu", () => {
    const { container } = render(<TutorialOverlay />);
    const botoes = container.querySelectorAll("button");
    // Todo botão de ação do tutorial é um .home-item (menu), fora o de pular.
    const homeItems = container.querySelectorAll("button.home-item");
    expect(botoes.length).toBeGreaterThan(0);
    expect(homeItems.length, "os botões devem ser .home-item").toBeGreaterThan(0);
  });

  it("NÃO escurece a tela (sem máscaras): o balão não pode ficar escondido", () => {
    // Regressão: o escurecimento (4 painéis / overlay cheio) cobria e cortava o
    // balão. O tutorial guia só com o anel de destaque, sem escurecer nada.
    const { container } = render(<TutorialOverlay />);
    expect(container.querySelector(".tutorial-mask"), "não pode haver máscara escura").toBeNull();
    expect(container.querySelector(".tutorial-mask--full"), "não pode haver overlay escuro cheio").toBeNull();
  });

  it("mostra o passo atual (contador) usando a tipografia do menu", () => {
    const { container } = render(<TutorialOverlay />);
    expect(container.querySelector(".fullscreen-prompt-eyebrow")?.textContent).toMatch(/PASSO\s+1/i);
  });
});

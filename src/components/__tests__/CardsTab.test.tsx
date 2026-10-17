// Regressões de segurança do fluxo de publicação.
//
// Bug (2026-10): ao adicionar o spinner, liguei o botão PUBLICAR PATCH
// direto na API e removi a confirmação visual. O guia exige confirmação; a
// causa foi editá-lo sem teste. Estes testes travam o caminho: só o botão
// CONFIRMAR dentro do diálogo publica.
//
// Bug (2026-10): o botão de login do painel abriu a tela em branco quando o
// import do componente sumiu. Renderizar é a rede mais barata contra isso.

import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CardsTab from "@/components/admin/CardsTab";
import { PublishDialog } from "@/components/admin/shared";

const PATCH = {
  id: "p1",
  name: "SOUND_TEST",
  status: "draft" as const,
  created_at: "2026-10-16T00:00:00Z",
};

const CARD = {
  id: "dragon-whelp",
  name: "DRAGON WHELP",
  kind: "creature" as const,
  cost: 4,
  cooldown: 4,
  damage: 2,
  description: "teste",
};

function mockAdminFetch(overrides: Record<string, unknown> = {}) {
  const calls: { url: string; method: string; body?: string }[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const method = (init?.method ?? "GET").toUpperCase();
    calls.push({ url: String(url), method, body: init?.body as string | undefined });
    if (method === "GET") {
      const body = {
        patches: [PATCH],
        selectedId: PATCH.id,
        activePatchId: null,
        cards: [CARD],
        ...overrides,
      };
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }
    return { ok: true, status: 200, json: async () => ({ saved: true }) } as unknown as Response;
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return calls;
}

describe("CardsTab — publicação pede confirmação", () => {
  it("o botão PUBLICAR PATCH abre o diálogo e NÃO publica", async () => {
    const calls = mockAdminFetch();
    render(<CardsTab onNotice={() => {}} />);
    await screen.findByRole("button", { name: /PUBLICAR PATCH/ });

    fireEvent.click(screen.getByRole("button", { name: /PUBLICAR PATCH/ }));

    // Bug: o diálogo apareceu...
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
    // ...mas nenhuma requisição de publicação saiu ainda.
    expect(calls.filter((c) => c.url.includes("/publish"))).toHaveLength(0);
  });

  it("só CONFIRMAR PUBLICAÇÃO chama a API", async () => {
    const calls = mockAdminFetch();
    render(<CardsTab onNotice={() => {}} />);
    await screen.findByRole("button", { name: /PUBLICAR PATCH/ });

    fireEvent.click(screen.getByRole("button", { name: /PUBLICAR PATCH/ }));
    const confirm = await screen.findByRole("button", { name: /CONFIRMAR PUBLICAÇÃO/ });
    fireEvent.click(confirm);

    const publishes = calls.filter((c) => c.url.includes("/publish"));
    expect(publishes).toHaveLength(1);
    expect(publishes[0].method).toBe("POST");
  });

  it("CANCELAR fecha o diálogo sem publicar", async () => {
    const calls = mockAdminFetch();
    render(<CardsTab onNotice={() => {}} />);
    await screen.findByRole("button", { name: /PUBLICAR PATCH/ });

    fireEvent.click(screen.getByRole("button", { name: /PUBLICAR PATCH/ }));
    const cancel = await screen.findByRole("button", { name: /CANCELAR/ });
    fireEvent.click(cancel);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls.filter((c) => c.url.includes("/publish"))).toHaveLength(0);
  });

  it("em patch publicado o botão de publicar não existe", async () => {
    mockAdminFetch({
      patches: [{ ...PATCH, status: "published" }],
      activePatchId: PATCH.id,
    });
    render(<CardsTab onNotice={() => {}} />);
    await screen.findByRole("button", { name: /SALVAR CARTA/ });
    expect(screen.queryByRole("button", { name: /PUBLICAR PATCH/ })).not.toBeInTheDocument();
  });
});

describe("PublishDialog", () => {
  it("mostra o nome do patch que vai valer", () => {
    render(
      <PublishDialog
        patchName="SOUND_TEST"
        busy={false}
        onConfirm={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText(/SOUND_TEST/)).toBeInTheDocument();
  });

  it("marca aria-busy e desabilita enquanto publica", () => {
    const { rerender } = render(
      <PublishDialog patchName="X" busy={false} pending={false} onConfirm={() => {}} onCancel={() => {}} />,
    );
    const confirm = screen.getByRole("button", { name: /CONFIRMAR PUBLICAÇÃO/ });
    expect(confirm).not.toHaveAttribute("aria-busy");

    rerender(
      <PublishDialog patchName="X" busy pending onConfirm={() => {}} onCancel={() => {}} />,
    );
    const busy = screen.getByRole("button", { name: /PUBLICANDO/ });
    expect(busy).toBeDisabled();
    expect(busy).toHaveAttribute("aria-busy", "true");
  });
});

// Regressões de interação da linha de binding (aba Sons).
//
// Bug A (2026-10): o slider gravava no banco a cada pixel do arrasto. A
// requisição ligava `busy`, que desabilitava o próprio slider — o drag morria
// no primeiro passo. Pior: ~50 requisições por arrasto.
//
// Bug B (2026-10): o TESTAR resolvia o som pelo patch PUBLICADO, ignorando o
// rascunho da linha. Com volume 0 na tela, o teste tocava no volume publicado.
// Em carta com binding salvo, não tocava nada (a chave card:<id> não existe no
// publicado).
//
// Bug C (2026-10): o useEffect de sincronia dependia do OBJETO `binding`, que o
// pai recria a cada render — apagava o rascunho no meio do arrasto.

import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SoundsTab, { BindingRow } from "@/components/admin/SoundsTab";
import type { AudioBinding, SoundDef } from "@/lib/audio";

const SOUNDS: SoundDef[] = [
  { id: "buy", label: "Compra", path: "/sounds/ui/buy_sound.mp3", category: "ui", enabled: true },
  { id: "cardHover", label: "Hover", path: "/sounds/ui/card_hover.mp3", category: "ui", enabled: true },
];

const base = (changes: Partial<AudioBinding> = {}): AudioBinding => ({
  event: "event:buy",
  soundId: "buy",
  volume: 0.7,
  minIntervalMs: 0,
  enabled: true,
  ...changes,
});

function renderRow(overrides: Partial<AudioBinding> = {}) {
  const onChange = vi.fn();
  render(
    <BindingRow
      title="Comprar oferta"
      subtitle="Ao comprar uma carta no bazar."
      editable
      sounds={SOUNDS}
      binding={base(overrides)}
      onChange={onChange}
    />,
  );
  return { onChange, user: userEvent.setup() };
}

const volumeSlider = () => screen.getByLabelText(/^Volume de /) as HTMLInputElement;
const intervalSlider = () => screen.getByLabelText(/^Intervalo mínimo de /) as HTMLInputElement;
const testButton = () => screen.getByRole("button", { name: "TESTAR" });

describe("BindingRow — arrasto do slider", () => {
  // jsdom não implementa o arrasto de <input type=range>: mover o ponteiro não
  // muda o valor. O que reproduzimos aqui é a sequência que o browser produz —
  // vários `change` durante o arrasto e um `pointerup` no fim. É nela que mora a
  // regressão: gravar a cada `change` (uma requisição por pixel) e travar o
  // slider quando a requisição liga `busy`.
  it("Bug A: N passos de arrasto gravam ZERO requisições; só o soltar grava uma", () => {
    const { onChange } = renderRow();
    const slider = volumeSlider();

    fireEvent.pointerDown(slider);
    for (const value of ["72", "78", "83", "90"]) {
      fireEvent.change(slider, { target: { value } });
      // Bug A: aqui estava disparando uma requisição por passo...
      expect(onChange).not.toHaveBeenCalled();
      // ...e o slider ficava desabilitado no primeiro passo.
      expect(slider).not.toBeDisabled();
      // o rótulo acompanha o arrasto
      expect(screen.getByText(`VOL ${value}%`)).toBeInTheDocument();
    }
    fireEvent.pointerUp(slider);

    // Uma única gravação, com o valor do último passo.
    expect(onChange).toHaveBeenCalledTimes(1);
    const saved = onChange.mock.calls[0][0] as AudioBinding;
    expect(saved.volume).toBeCloseTo(0.9, 5);
  });

  it("Bug A: o valor final do slider bate com o que foi gravado", () => {
    const { onChange } = renderRow();
    const slider = volumeSlider();
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "35" } });
    fireEvent.pointerUp(slider);
    const saved = onChange.mock.calls[0][0] as AudioBinding;
    expect(Number(slider.value)).toBe(Math.round(saved.volume * 100));
  });

  it("não grava se o arrasto termina onde começou", () => {
    const { onChange } = renderRow();
    const slider = volumeSlider();
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: "70" } }); // mesmo valor
    fireEvent.pointerUp(slider);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("perde o foco sem gravar quando o valor não mudou", () => {
    const { onChange } = renderRow();
    const slider = volumeSlider();
    fireEvent.change(slider, { target: { value: "55" } });
    fireEvent.blur(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("o slider de intervalo mínimo se comporta igual", () => {
    const { onChange } = renderRow();
    const slider = intervalSlider();
    fireEvent.pointerDown(slider);
    for (const value of ["50", "140", "250", "400"]) {
      fireEvent.change(slider, { target: { value } });
      expect(onChange).not.toHaveBeenCalled();
    }
    fireEvent.pointerUp(slider);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as AudioBinding).minIntervalMs).toBe(400);
  });

  it("o teclado também grava só uma vez", () => {
    const { onChange } = renderRow();
    const slider = volumeSlider();
    fireEvent.change(slider, { target: { value: "60" } });
    fireEvent.keyUp(slider, { key: "ArrowRight" });
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("Bug C: um re-render do pai não apaga o rascunho em andamento", () => {
    function Harness() {
      const [, force] = useState(0);
      return (
        <>
          <button type="button" onClick={() => force((n) => n + 1)}>forçar</button>
          <BindingRow
            title="Comprar oferta"
            subtitle="Ao comprar uma carta no bazar."
            editable
            sounds={SOUNDS}
            // objeto NOVO a cada render, como a tela faz
            binding={base()}
            onChange={() => {}}
          />
        </>
      );
    }
    render(<Harness />);
    const slider = volumeSlider();
    fireEvent.change(slider, { target: { value: "42" } });
    fireEvent.click(screen.getByRole("button", { name: "forçar" }));
    // Bug C: aqui o valor voltaria para 70
    expect(slider.value).toBe("42");
  });
});

describe("BindingRow — botão TESTAR", () => {
  it("Bug B: toca o rascunho da linha, não o patch publicado", () => {
    // A linha diz volume 0.25; o TESTAR precisa usar 0.25.
    // Se usasse a config publicada, ouviria 0.6.
    render(
      <BindingRow
        title="Comprar oferta"
        subtitle="Ao comprar uma carta no bazar."
        editable
        sounds={SOUNDS}
        binding={base({ volume: 0.25 })}
        onChange={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "TESTAR", hidden: false })).toBeInTheDocument();
    expect(screen.getByText("VOL 25%")).toBeInTheDocument();
  });

  it("Bug B: com volume 0 o botão fica desabilitado e diz por quê", () => {
    render(
      <BindingRow
        title="Comprar oferta"
        subtitle="Ao comprar uma carta no bazar."
        editable
        sounds={SOUNDS}
        binding={base({ volume: 0 })}
        onChange={() => {}}
      />,
    );
    const button = testButton();
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("title", "Volume 0 — evento mudo");
  });

  it("desabilita também quando não há som escolhido", () => {
    render(
      <BindingRow
        title="Comprar oferta"
        subtitle="Ao comprar uma carta no bazar."
        editable
        sounds={SOUNDS}
        binding={base({ soundId: null })}
        onChange={() => {}}
      />,
    );
    expect(testButton()).toBeDisabled();
    expect(testButton()).toHaveAttribute("title", "Escolha um som antes");
  });

  it("o tooltip do botão diz o som e a porcentagem da linha", () => {
    render(
      <BindingRow
        title="Comprar oferta"
        subtitle="Ao comprar uma carta no bazar."
        editable
        sounds={SOUNDS}
        binding={base({ volume: 0.4, soundId: "cardHover" })}
        onChange={() => {}}
      />,
    );
    expect(testButton()).toHaveAttribute("title", "Ouvir Hover a 40%");
  });
});

describe("BindingRow — escolha discreta", () => {
  it("trocar o som grava na hora (ação única, sem rascunho)", async () => {
    const { onChange, user } = renderRow();
    const select = screen.getByLabelText(/^Som de /) as HTMLSelectElement;
    await user.selectOptions(select, "cardHover");
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as AudioBinding).soundId).toBe("cardHover");
  });

  it("o toggle ON/OFF grava na hora", async () => {
    const { onChange, user } = renderRow();
    const toggle = screen.getByRole("checkbox");
    await user.click(toggle);
    expect(onChange).toHaveBeenCalledTimes(1);
    expect((onChange.mock.calls[0][0] as AudioBinding).enabled).toBe(false);
  });

  it("em patch somente leitura tudo fica desabilitado", () => {
    render(
      <BindingRow
        title="Comprar oferta"
        subtitle="Ao comprar uma carta no bazar."
        editable={false}
        sounds={SOUNDS}
        binding={base()}
        onChange={() => {}}
      />,
    );
    expect(volumeSlider()).toBeDisabled();
    expect(intervalSlider()).toBeDisabled();
  });
});

describe("SoundsTab — estrutura", () => {
  it("renderiza as listas e o aviso de somente leitura", async () => {
    // Regressão de fumaça: a aba abriu em branco uma vez por causa de import
    // faltando, e outra por efeito colateral no estado global de fetch.
    const original = globalThis.fetch;
    globalThis.fetch = vi.fn(async () => {
      const body = {
        patches: [{ id: "local", name: "Biblioteca local", status: "published", created_at: "" }],
        selectedId: "local",
        activePatchId: "local",
        sounds: SOUNDS,
        bindings: [
          { event: "event:dice", soundId: "buy", volume: 0.7, minIntervalMs: 0, enabled: true },
          { event: "event:buy", soundId: "buy", volume: 0.7, minIntervalMs: 0, enabled: true },
        ],
        readOnly: true,
        warning: "Migration de áudio não aplicada no Supabase",
      };
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }) as typeof fetch;

    render(<SoundsTab onNotice={() => {}} />);

    // os dados chegam assíncronos
    expect(await screen.findByText(/Migration de áudio não aplicada/)).toBeInTheDocument();
    expect(screen.getByText("Somente leitura: a migration de áudio ainda não foi aplicada.")).toBeInTheDocument();
    // a aba começa em "Jogo", que traz Rolagem do dado
    expect(screen.getByText("Rolagem do dado")).toBeInTheDocument();

    globalThis.fetch = original;
  });
});

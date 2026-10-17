// Guarda de integridade do `app/globals.css`.
//
// Bug (2026-10): o arquivo terminava com `}\ner;\n}` — resto de uma edição
// anterior. O Next não complains no typecheck nem nos testes: ele só quebra em
// tempo de build do CSS, e a página inteira responde 500 com
// "Syntax error: globals.css Unknown word". Foi preciso abrir o navegador para
// descobrir.
//
// Regra: o CSS precisa estar balanceado e sem tokens órfãos no fim do arquivo.

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const FILE = path.resolve(__dirname, "../globals.css");
const CSS = readFileSync(FILE, "utf-8");

/** Remove comentários e strings para não contar `}` que não fecham bloco. */
function semComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\\./g, "");
}

describe("globals.css: integridade sintática", () => {
  it("não deixa tokens órfãos no fim do arquivo", () => {
    // Bug do `er;` solto: a última chave não abria nada e não fechava nada.
    expect(CSS.trimEnd()).toMatch(/\}\s*$/);
    expect(CSS.trimEnd().split("\n").pop()!.trim()).toBe("}");
  });

  it("chaves balanceadas", () => {
    const limpo = semComments(CSS);
    const abre = (limpo.match(/\{/g) ?? []).length;
    const fecha = (limpo.match(/\}/g) ?? []).length;
    expect(abre, "abre != fecha: alguma regra ficou sem fechar").toBe(fecha);
    expect(abre, "nenhuma regra encontrada — leitura do arquivo falhou?").toBeGreaterThan(500);
  });

  it("cada bloco fecha na mesma linha em que abre", () => {
    // Padrão de formatação do arquivo: `{` e `}` na própria linha.
    const linhas = semComments(CSS).split("\n");
    const depth = (() => {
      let d = 0;
      const erros: number[] = [];
      linhas.forEach((linha, i) => {
        for (const ch of linha) {
          if (ch === "{") d++;
          else if (ch === "}") {
            d--;
            if (d < 0) erros.push(i + 1);
          }
        }
      });
      return { d, erros };
    })();
    expect(depth.erros, "fecha de bloco a mais que abre").toEqual([]);
    expect(depth.d, "sobrou bloco aberto").toBe(0);
  });

  it("não deixa fragmentos de declaração órfãos fora de qualquer bloco", () => {
    // Bug do `er;`: fragmento de `border: ...;` que sobrou no fim do arquivo,
    // fora de qualquer regra. Dentro de bloco, continuation lines são normais,
    // então a profundidade é o que separa lixo de CSS válido.
    const linhas = semComments(CSS).split("\n");
    let depth = 0;
    const orfaos: string[] = [];
    linhas.forEach((linha, i) => {
      if (depth === 0 && /^[a-z][a-z0-9-]*;$/i.test(linha.trim())) {
        orfaos.push(`${i + 1}: ${linha.trim()}`);
      }
      for (const ch of linha) {
        if (ch === "{") depth++;
        else if (ch === "}") depth--;
      }
    });
    expect(orfaos, "fragmento de declaração fora de bloco").toEqual([]);
  });
});
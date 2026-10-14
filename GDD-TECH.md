# GDD Técnico & Plano de Arquitetura

> Documento derivado do `GDD.md`. Resolve conflitos internos, define a stack e o
> plano de implementação. Itens marcados com **⚠️ DECIDIR** são defaults que
> escolhi — confirme ou corrija.

---

## 0. Decisões de produção (confirmadas)

| Tema | Decisão |
|---|---|
| Arte do tabuleiro | 3D low-poly em Three.js (estilo da referência top-down) |
| Arte das cartas | 2D em HTML/CSS com `react-tilt` (mão e loja) |
| Mobs no tabuleiro | Primitivas/cubos coloridos por elemento (placeholder jogável) |
| Semi-online | Snapshots de bots em JSON, gerados por IA local + `localStorage` |

---

## 1. Conflitos do GDD → valores canônicos

Fonte da verdade a partir de agora é esta tabela. (**⚠️ DECIDIR** = confirme.)

| Constante | GDD dizia | **Valor canônico** |
|---|---|---|
| HP inicial do jogador | §1: 60 / §5: 100 | **100** ⚠️ DECIDIR |
| HP do bot inimigo | §1: 60 | **100** (simétrico) ⚠️ DECIDIR |
| Teto de mana | §2: 10 / §5: sem limite | **sem limite** ⚠️ DECIDIR |
| Mana por rodada | 1d6 | 1d6, acumula entre rodadas |
| Ofertas na loja | 3 | 3 |
| Preço da carta | custo + 1 | custo + 1 (pago em mana) |
| Vitórias p/ vencer a run | 3 contra player | 3 |
| Derrota | perder p/ player OU HP = 0 | run acaba |
| Duração da batalha | máx. 30s | 30s (timeout → compara HP restante) ⚠️ DECIDIR desempate |

---

## 2. Stack técnica

```
Vite + React 18 + TypeScript
├── three + @react-three/fiber + @react-three/drei   # cena 3D do tabuleiro
├── zustand                                           # estado global do jogo
├── react-tilt (ou vanilla-tilt)                      # efeito 3D nas cartas 2D
├── framer-motion                                     # animações de UI (HUD, loja, cartas)
└── (futuro) backend p/ snapshots reais
```

Por que: `react-three-fiber` deixa a cena 3D declarativa dentro do React, então
HUD 2D e tabuleiro 3D convivem na mesma árvore. `zustand` mantém a lógica de jogo
fora dos componentes (testável e determinística para o auto-battler).

---

## 3. Estrutura de pastas

```
src/
├── main.tsx
├── App.tsx                      # roteia telas (menu → run → fim)
├── game/
│   ├── types.ts                 # Card, Creature, Building, Terrain, Snapshot, Elem
│   ├── data/
│   │   ├── cards.ts             # catálogo de criaturas/construções/terrenos (§8)
│   │   ├── items.ts             # itens de loja c/ bônus elementais (§5) ⚠️ a definir
│   │   └── constants.ts         # tabela da §1 acima
│   ├── store.ts                 # zustand: estado da run + ações do loop
│   ├── phases/                  # máquina de estados do loop
│   │   ├── dice.ts              # rola 1d6, soma mana
│   │   ├── shop.ts              # gera 3 ofertas, compra
│   │   ├── farm.ts              # mobs de jungle, 5 tiros, recompensas (§6)
│   │   └── battle.ts            # simulação em tempo real, cooldowns (§7)
│   ├── bot.ts                   # IA que monta build e gera snapshot JSON (§9)
│   └── combat/
│       └── simulate.ts          # tick determinístico (dano por tiro, escudos)
├── scene/                       # Three.js / R3F
│   ├── Board.tsx                # grade 3x4 por lado, InstancedMesh de tiles
│   ├── Tile.tsx                 # terreno pintável + highlight de drop
│   ├── Unit.tsx                 # cubo/primitiva do mob c/ barra de cooldown
│   ├── Projectile.tsx           # tiro animado por elemento (§7)
│   └── Camera.tsx               # OrthographicCamera top-down em ângulo
├── ui/                          # React 2D (DOM, por cima do canvas)
│   ├── Card.tsx                 # carta c/ react-tilt, glow por elemento (img 3)
│   ├── Hand.tsx                 # leque de cartas na mão
│   ├── Shop.tsx                 # 3 ofertas + preços
│   ├── HUD.tsx                  # HP, mana, rodada, vitórias, fase atual
│   └── PhaseBanner.tsx          # transições (framer-motion)
└── styles/
```

---

## 4. Modelo de estado (zustand)

```ts
type Elem = 'fire' | 'water' | 'grass';
type Phase = 'dice' | 'shop' | 'farm' | 'battle' | 'result';

interface RunState {
  character: Elem;
  playerHP: number;          // começa em 100
  mana: number;              // acumula
  round: number;
  wins: number;              // 0..3 → vitória da run
  phase: Phase;
  hand: Card[];
  board: BoardCell[];        // 6 casas do player (3col x 2linhas)
  enemyBoard: BoardCell[];   // oculto fora da batalha (§4)
  shopOffers: Card[];
  snapshots: Snapshot[];     // 3 bots do loop
}
```

A grade é 3 colunas × 4 linhas no total (§4): **2 linhas de frente/trás por
lado**, lados opostos se encaram. Invocação só em casa com terreno do elemento (§4).

---

## 5. Regras de combate (determinísticas)

- **Batalha (§7):** cada criatura atira a cada `cooldown`s; dano direto no HP
  inimigo. Loop de simulação a passos fixos (ex: 60Hz lógico) para ser
  reproduzível a partir de um snapshot. Escudos (itens) reduzem dano recebido.
- **Farm (§6):** 2–4 mobs de jungle (HP 1–3), cada criatura do player dá 5 tiros
  no mob da frente; recompensa = ⌊HP/2⌋ de mana por abate. Bônus elemental por
  criatura em campo, teto 3: Fogo +1 ATK / Água +1 DEF / Grama cura 1.
- **Terreno duplicado (§4):** 2 terrenos iguais na mesma casa = bônus do elemento
  à unidade nela. (**⚠️ DECIDIR** valor exato do bônus; proponho +1/+1.)

---

## 6. Construções (§8) e itens de loja (§5)

Construções já definidas: Muralha (+2 DEF adjacente), Depósito (+2 mana/dado),
Altar (cura = metade do dano no farm).

**Itens de loja ainda não existem no GDD.** Proposta de MVP (universais, com
atributo extra por elemento, estilo LoL/Dota) — **⚠️ DECIDIR**:

| Item | Efeito base | Bônus por elemento |
|---|---|---|
| Lâmina | +1 ATK na unidade | Fogo: +2 em vez de +1 |
| Escudo | jogador recebe escudo de 3 | Água: escudo de 5 |
| Totem | +1 cooldown reduzido | Grama: +cura 1/tiro |

---

## 7. Bot & snapshots (§9)

`bot.ts` roda o mesmo loop (compra melhor carta que paga → invoca → farma),
congela o resultado num `Snapshot` JSON (board + itens + stats). Geramos **3
snapshots** no início da run; o player enfrenta um por vitória. Formato pensado
para, no futuro, vir de um backend sem mudar o simulador.

```ts
interface Snapshot { character: Elem; board: BoardCell[]; hp: number; }
```

---

## 8. Plano de implementação (ordem de PRs/commits)

1. **Scaffold** — Vite+React+TS, deps, estrutura de pastas, tela de menu.
2. **Dados & store** — catálogo de cartas (§8), constantes, store do loop vazio.
3. **Tabuleiro 3D** — Board/Tile/Camera, grade 3×4, pintar terreno, drop de carta.
4. **Cartas 2D** — Card com react-tilt + glow (img 3), Hand, Shop.
5. **Loop** — máquina de estados DADO→LOJA→FARM→BATALHA→resultado + HUD.
6. **Combate** — simulador determinístico, cooldowns, projéteis, escudos.
7. **Farm** — mobs de jungle, recompensas, bônus elemental.
8. **Bot & snapshots** — IA, geração de 3 snapshots, condição de vitória (3 wins).
9. **Polish** — animações framer-motion, transições de fase, SFX placeholder.

Cada passo entrega algo rodando. O MVP jogável ponta-a-ponta sai no passo 8.

---

## 9. Perguntas abertas (não bloqueiam o início)

- HP 100 vs 60? Teto de mana?  → usei os defaults da §1 acima.
- Lista final de itens de loja e bônus elementais.
- Bônus numérico de terreno duplicado.
- Desempate quando a batalha chega a 30s.

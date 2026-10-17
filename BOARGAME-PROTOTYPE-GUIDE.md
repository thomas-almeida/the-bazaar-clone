# MAGGI — guia do protótipo e do estado atual

Este documento diferencia duas coisas que coexistem no repositório:

1. **`src/boargame/`** é o protótipo standalone original, preservado como
   referência histórica e visual.
2. **A aplicação atual** é a versão em Next.js na raiz do projeto. Ela porta a
   experiência do tabuleiro e acrescenta o loop de run, magos, tiers, combate
   com haste, música e editor administrativo de balanceamento.

Use este guia para entender o que está implementado hoje. Regras descritas como
planejadas não devem ser tratadas como funcionalidades prontas.

## 1. Rodar o projeto

Requisitos: Node.js/npm e as variáveis de ambiente indicadas na seção
[Editor de balanceamento](#8-editor-de-balanceamento).

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`. Os comandos disponíveis incluem `npm run build`
para o build de produção, `npm test` para a suíte de regressão e
`npm run typecheck` para o TypeScript.

### Testes de regressão

`npm test` roda o Vitest (jsdom). A suíte existe para travar erros que já
aconteceram neste projeto; cada arquivo diz no cabeçalho qual foi o incidente.

| Arquivo | Trava |
| --- | --- |
| `src/lib/__tests__/admin-audio.test.ts` | `sound_id` camelCase e chaves de evento com ponto/maiúscula. Bug 1 derrubou a migration; bug 2 teria dado 400 em todo binding de interface. |
| `src/lib/__tests__/leaderboard.test.ts` | Validação de `slots` (descarta posição ruim, nunca a run) e o contrato de 4 posições. |
| `src/lib/__tests__/mage-voice.test.ts` | Caminho da fala vem do nome de exibição, não do id; canal exclusivo; guarda de 2,5 s; chance de 30% do `CARD_PLACE`. |
| `src/components/__tests__/SoundsTab.test.tsx` | Arrasto do slider grava **uma** vez ao soltar e nunca se autodesabilita; TESTAR respeita o rascunho e desabilita em volume 0. |
| `src/lib/__tests__/healing-max-health.test.ts` | Cura sem teto (o exemplo do pedido), reset do ganho entre fases, MURALHA dobrando só a base. |
| `src/components/__tests__/leaderboard-page.test.tsx` | Linha sem build não desenha grade; com build desenha os 4 slots e o tooltip. |
| `src/components/__tests__/CardsTab.test.tsx` | PUBLICAR PATCH abre o diálogo e **não** publica sozinho. |
| `src/components/__tests__/CardFace.test.tsx` | Arte como fundo (z 0) < véu (z 1) < texto (z 2); borda de 3px na cor do tier; selo ao lado do custo. Trava a atribuição de pseudo-elementos: `::after` da carta é brilho de hover e `::before/::after` da arte são cooldown — o véu é o elemento `.card-scrim`. **Performance:** carta de arte em vídeo mostra o pôster parada e só monta o `<video>` no hover (e volta ao pôster ao sair). |
| `src/components/__tests__/TutorialOverlay.test.tsx` | A interface do tutorial reusa a UI do menu (`.fullscreen-prompt-panel`, `.home-item`) e **não** inventa UI própria; o tutorial **não escurece a tela** (sem máscaras), para o balão nunca ficar escondido. |
| `app/__tests__/tutorial.test.ts` | Roteiro do tutorial: cobre um ciclo (bazar → aventura → batalha) e cada condição de avanço reage à ação certa (rolar dado, abrir loja, comprar, posicionar, avançar, escolher recompensa, iniciar batalha). |
| `app/__tests__/globals-css.test.ts` | Integridade sintática do CSS (chaves balanceadas, sem fragmento órfão). Bug: o arquivo terminou com `}\ner;\n}` e derrubou o app inteiro com 500 — só o build do CSS acusava. |

### Anatomia da carta

```
article.hand-card.tier-S          borda 3px = var(--card-accent)   box-sizing: border-box
├── .card-synergy-badge           absoluta (canto inferior esquerdo)
├── header.card-header            z 2 · véu próprio para ler o nome
│   ├── .card-name                encolhe com reticências
│   └── .card-topright            z 2 · canto superior direito
│       ├── .card-cost            19px
│       └── .card-tier-badge      letra do tier, cor do tier
├── .card-art                     z 0 · position: absolute; inset: 0 — A ARTE É O FUNDO
├── .card-scrim                   z 1 · véu escuro (elemento, não pseudo-elemento)
└── .card-info (display: contents)
    ├── .card-type                margin-top: auto → encosta embaixo
    ├── .card-level
    └── .card-stats
```

Pontos que quebram se alguém mexer sem pensar:

- **A arte não pode virar `background-image`.** `Art` é `{kind: "image" | "video"}` e o
  feitiço usa vídeo do mago em loop; precisa continuar sendo `<img>`/`<video>` numa
  camada absoluta. Sem arte, o gradiente de tier (`--card-background`) fica de reserva.
- **Vídeo só toca no hover.** Parada, a carta de vídeo mostra o **pôster** (`<img>`);
  o `<video autoplay loop>` só é montado enquanto a carta está em hover e é
  desmontado ao sair. Sem isso, um tabuleiro/loja/grade de deck renderiza dezenas
  de vídeos decodificando ao mesmo tempo — era a causa principal de lentidão geral.
- **Pseudo-elementos da carta já têm dono.** `.hand-card::after` = brilho de hover
  (`opacity: 0` no repouso, e `display: none` nas cartas do tabuleiro);
  `.card-art::before/::after` = cooldown. Um véu em `::after` apagaria o brilho e
  sumiria no tabuleiro. Daí o `.card-scrim` ser elemento próprio.
- **A carta é `border-box` e mede `var(--card-width) * 1.1 × * 1.48`.** A borda de
  3px come da caixa de conteúdo, nunca do tamanho externo — a geometria do tabuleiro
  não muda. Só o que está dentro é redistribuído.

Ao mexer em `src/lib/sfx.ts`, `mage-voice.ts`, `admin-audio.ts`, no `CardFace` ou
nas abas do painel, rode `npm test` antes de declarar pronto.

> `app/globals.css` é a folha **única** carregada (`app/layout.tsx`).
> `src/boargame/board.css` é cópia de referência e **não** entra no runtime —
> se mudar o visual, o lugar a editar é `globals.css`.

### Guarda de build

`npm run build` chama `scripts/check-dev-server.mjs` primeiro e **aborta se
houver um `next dev` rodando**. Build e dev server dividem o diretório `.next` e
se corrompem juntos (sintoma: `Expected clientReferenceManifest to be defined`).
Para forçar: `MAGGI_SKIP_DEV_CHECK=1 npm run build`.

## 2. Estrutura e fontes de verdade

| Caminho | Responsabilidade |
| --- | --- |
| `app/page.tsx` | Menu principal e navegação. |
| `app/play/page.tsx` | Carrega o catálogo e inicia o fluxo de jogo. |
| `app/magos/page.tsx` | Galeria de magos e prévia dos decks. |
| `app/admin/page.tsx` | Casca do painel: sessão administrativa e abas (Cartas, Sons). |
| `app/api/catalog/route.ts` | Serve o catálogo ativo para o jogo. |
| `app/api/audio/route.ts` | Serve a configuração de áudio publicada. |
| `app/api/admin/` | Sessão administrativa, patches, edição e upload de arte. |
| `app/api/admin/audio/` | Patches de áudio: biblioteca, bindings, publicação e upload. |
| `app/globals.css` | Tailwind CSS v4, layout do tabuleiro e estilos da interface. |
| `app/leaderboard/page.tsx` | Tela do placar de líderes (última run de cada jogador). |
| `app/api/catalog/route.ts` | Serve o catálogo ativo para o jogo. |
| `app/api/snapshots/route.ts` | Sorteia a build de um jogador real para a fase de rival (PVP assíncrono). |
| `app/api/leaderboard/route.ts` | Lê o ranking do placar. |
| `app/api/admin/` | Sessão administrativa, patches, edição e upload de arte. |
| `src/lib/catalog.ts` | Catálogo local de cartas, configuração e builds de NPCs/rivais (fallback). |
| `src/lib/store.ts` | Estado da run, transições de fase, lojas, aventura, versus e efeitos de combate. |
| `src/lib/passives.ts` | Passivas de tabuleiro por mago (slot 3, cura adjacente, escudo em dobro). |
| `src/lib/snapshots.ts` | Gravação/leitura de snapshots de build (PVP assíncrono). |
| `src/lib/leaderboard.ts` | Gravação/leitura do placar (upsert por jogador). |
| `src/lib/audio.ts` | Contrato de áudio: biblioteca padrão e registro de eventos nomeados. |
| `src/lib/admin-audio.ts` | Validação de som e binding nas rotas de admin. |
| `src/lib/public-path.ts` | Normalização de caminho público (arte e som). |
| `src/lib/sfx.ts` | Config de áudio publicada, resolução de eventos e reprodução. |
| `src/lib/backgrounds.ts` | Temas de fundo (vídeo + trilha) sorteados e sincronizados. |
| `src/lib/` | Tipos, artes, magos, tiers, sinergias, haste e névoa. |
| `src/hooks/useCombatEngine.ts` | Ciclos de combate, haste, popups, projéteis, névoa e sons de carta. |
| `src/components/` | Tabuleiro, cartas, HUD, modais (versus, mago, ajustes), mão e telas. |
| `src/components/TutorialOverlay.tsx` | Camada do tutorial guiado (APRENDER MAGGI): anel de destaque + balão com a UI do menu. |
| `src/lib/tutorial.ts` | Roteiro do tutorial (passos e condições de avanço), isomórfico e testável. |
| `src/components/SoundProvider.tsx` | Carrega a config de áudio e destrava o som no primeiro gesto. |
| `src/components/useSoundEvent.ts` | Liga um evento nomeado a um elemento da interface. |
| `src/components/admin/` | Abas Cartas e Sons do painel de balanceamento. |
| `supabase/migrations/` | Schema e catálogo inicial do editor de balanceamento e de áudio. |
| `supabase/build_snapshots.sql` | Tabela de snapshots de build (PVP assíncrono). |
| `supabase/leaderboard.sql` | Tabela do placar de líderes, com a build final (`slots`). |
| `public/boargame/img/` | Artes, vídeos de fundo e trilhas servidas pela aplicação. |
| `public/sounds/` | Efeitos sonoros (`dice/`, `itens/`, `ui/`). |
| `src/boargame/` | Referência standalone original; preservar. |

O app usa **Next.js App Router, React, TypeScript, Zustand e Tailwind CSS v4**.
Tailwind v4 é uma dependência necessária para futuras edições manuais de UI.

O tabuleiro permanece construído em HTML/CSS com geometria **CSS 3D**; não é
renderizado com React Three Fiber. `src/boargame/board.html`, `board.css`,
`board.js` e seus assets continuam sendo uma referência útil, mas a aplicação
ativa agora está em `app/` e `src/`.

## 3. Experiência visual e navegação

- **Menu:** usa vídeo de fundo com blur/overlay, logo, botões e trilha sonora.
  O item **AJUSTES** abre um modal com sliders de volume de música e efeitos
  (persistidos em `localStorage`); não há mais botão de mudo flutuante.
  A cada carregamento do menu sorteia-se um **tema de fundo** (par vídeo +
  trilha), definido em `src/lib/backgrounds.ts` e sincronizado entre o
  `AppBackground` (vídeo) e o `BackgroundMusic` (trilha).
- **Pré-seleção de mago:** clicar no retrato do mago no menu abre um modal com
  todos os magos; escolher um já o deixa pré-selecionado, e **JOGAR** entra
  direto na run (via `/play?mage=<id>`) sem passar pela tela de seleção.
- **Tela cheia:** no primeiro acesso aparece um modal para ativar fullscreen ou
  salvar a preferência de não mostrá-lo novamente.
- **Magos:** há três opções — NEON, ÁUREA e FERRO — com tema, retrato,
  especialidades e uma **passiva de tabuleiro** (ver seção 5). A galeria
  apresenta as cartas sem expor tier/nível; no jogo, as insígnias e cores de
  tier continuam visíveis.
- **Tabuleiro:** mantém a mesa em perspectiva, fileira superior contextual,
  quatro slots de jogador, barras de vida/escudo, console de dado/mana e mão em
  leque no canto inferior direito. As **badges** (jogador, bazar, bot, aventura)
  usam o estilo do retrato do menu (domo no topo + borda de acento + brilho),
  com o nome abaixo; a badge do jogador usa o acento do mago escolhido.
- **Cartas:** a mão permite hover com elevação e tilt 3D, seleção por clique,
  drag-and-drop, fusão de duplicatas e uso de coringas fora do combate.
- **Breakpoints:** a composição original tem referência visual em 1920×1080.
  Há ajustes responsivos na app, mas o alvo principal de fidelidade continua
  sendo a composição de desktop.
- **Rolagem:** usa uma scrollbar flat e discreta.

A intenção é preservar o visual do protótipo sem mudar proporções do tabuleiro
para resolver problemas de layout. Melhorias de interface são acrescentadas
fora da geometria aprovada.

### 3.1 Tutorial guiado (APRENDER MAGGI)

O botão **APRENDER MAGGI** no menu abre uma **run guiada**, sempre com o primeiro
mago, via `/play?mage=<id>&tutorial=1`. A camada é `TutorialOverlay`, montada
dentro do `GameBoard` e ativada só quando `?tutorial=1` está na URL; o roteiro
fica em `src/lib/tutorial.ts`.

- **Escopo:** um ciclo completo guiado — **Bazar → Aventura → Batalha de bot**.
  Ao concluir (ou pular), os tooltips somem e a run segue livre.
- **Passos:** cada passo mostra um **anel de destaque** no elemento relevante
  (dado, loja, carta/mão, AVANÇAR, recompensa, bot) e um balão de dica. Passos de
  explicação avançam no clique (CONTINUAR); passos de ação **avançam sozinhos**
  quando o jogador faz a ação ensinada (ex.: rolou o dado, comprou uma carta,
  posicionou no tabuleiro). As condições estão em `TUTORIAL_STEPS[].done`.
- **UI idêntica à do menu:** o balão reusa `.fullscreen-prompt-panel`,
  `.fullscreen-prompt-eyebrow`, `<h2>`, `.fullscreen-prompt-copy` e botões
  `.home-item` — sem inventar componentes. O painel é **preso dentro da janela**
  (clamp usando a altura medida) para nunca ser cortado.
- **Sem escurecer a tela:** o tutorial **não** usa máscaras escuras (o
  escurecimento cobria/cortava o balão). Guia só com o anel de destaque, mantendo
  o tabuleiro visível. Consequência: não bloqueia cliques fora de ordem — o anel
  orienta e o avanço automático só reage à ação certa.
- **Conclusão lembrada:** ao concluir ou pular, grava `tutorial_done` em
  `user_metadata` (silencioso; nunca trava o jogo) e remove `?tutorial=1` da URL
  para um F5 não reiniciar o tutorial no meio da run. O subtítulo do botão passa a
  "concluído ✓ · rejogar".

## 4. Loop de jogo atual

O fluxo é uma sequência local determinística de **três voltas**, cada uma com
esta sequência de nove fases (`PHASE_UNIT` em `store.ts`):

| Ordem na volta | Fase | O que acontece |
| ---: | --- | --- |
| 1 | Loja | Compras/preparação e rolagem obrigatória do dado. |
| 2 | Aventura | Três situações; escolher uma é opcional. |
| 3 | Bot/NPC | Escolha entre três NPCs; a luta começa após escolher. |
| 4 | Loja | Nova preparação. |
| 5 | Aventura | Novas situações; escolha opcional. |
| 6 | Bot/NPC | Nova escolha entre três NPCs. |
| 7 | Aventura | Novas situações; escolha opcional. |
| 8 | Loja | Última preparação da volta. |
| 9 | Rival (player) | Modal de versus; combate contra a build de um jogador real. |

Ao todo, uma run tem nove fases de loja, nove de aventura, seis combates contra
NPC e três combates contra rival. Ao vencer um combate, **CONTINUAR** avança
para a próxima fase e concede um coringa. Perder encerra a tentativa e oferece
reiniciar. Vencer o terceiro rival conclui a run.

### Loja e aventura

- As lojas são separadas por categoria: dano, cura, aceleração e escudo. Cada
  categoria oferece até três cartas aleatórias do catálogo ativo. A arte do
  vendedor é a capa de cada loja.
- A moeda está em modo de teste: mana infinita e preço exibido de 1 por oferta.
  O custo normal continua nos dados da carta, mas não é cobrado nessa
  configuração.
- A rolagem do dado é exigida para avançar de uma fase de loja. Com mana
  infinita, o valor não afeta compras.
- A configuração declara limite normal de mão 7, mas a inicialização atual do
  jogo sobrescreve esse valor para 999. Portanto, na prática, não há o limite
  normal de sete cartas nesta build de teste.
- A **aventura** (que substituiu a antiga roleta) apresenta três situações: uma
  carta aprimorada, +vida máxima ou um coringa de tier alto. É permitido avançar
  sem escolher. O NPC escolhido na fase de bot define um "tema" que influencia a
  loja/aventura do ciclo seguinte.
- Loja e aventura não iniciam combate. Cartas podem ser organizadas no tabuleiro
  fora do combate.

### Bots (NPC) e rival (PVP assíncrono)

Na fase de **bot**, três NPCs locais são sorteados e o jogador escolhe qual
enfrentar. Esses builds são estáticos (não representam usuários). Os decks são
resolvidos por IDs estáveis, então renomear uma carta não quebra as referências.

| Build | Cartas |
| --- | --- |
| MAGO DAS BRASAS | EMBER SPRITE, PHOENIX LORD, ARCANE BARRIER |
| ORÁCULO DA MARÉ | TIDE GUARDIAN, HEALING RAIN, ARCANE BARRIER |
| DRUIDA DO BOSQUE | THORN BEAST, MOONLIT MAGE, ARCANE BARRIER |
| DUELISTA DAS CINZAS | EMBER SPRITE, DRAGON WHELP, PHOENIX LORD, STARFALL |
| GUARDIÃ DA MARÉ | TIDE GUARDIAN, HEALING RAIN, MOONLIT MAGE, ARCANE BARRIER |
| CAMPEÃO DO BOSQUE | THORN BEAST, MOONLIT MAGE, PHOENIX LORD, HEALING RAIN |

Na fase de **rival (player)**, o jogo busca o **snapshot da build de um jogador
real** do mesmo "pass" via `GET /api/snapshots` e o apresenta no modal de versus.
Se o pool estiver vazio (ou sem login/Supabase), cai no rival estático como
fallback. A build real traz tier por carta, o mago e a vida máxima própria
(inclusive a passiva de escudo que dobra a vida — ver seção 5). A cada confronto
de rival, a build do jogador é gravada como snapshot (até 3 por run). Ver a
seção 8 para a infraestrutura.

A dificuldade visual/mecânica do oponente recebe o tier correspondente à volta
atual, limitado ao tier máximo.

## 5. Cartas, tiers e magos

O catálogo inicial contém **19 cartas**. Definições têm ID permanente, nome,
tipo, custo, recarga, descrição e campos próprios do tipo. A arte customizada é
opcional; sem ela, o jogo mantém a seleção de arte existente.

| ID | Carta | Tipo | Dados-base / efeito |
| --- | --- | --- | --- |
| `dragon-whelp` | DRAGON WHELP | Criatura | nível 1, custo 4, recarga 4 s, dano 2 |
| `phoenix-lord` | PHOENIX LORD | Criatura | nível 3, custo 7, recarga 5 s, dano 4 |
| `healing-rain` | HEALING RAIN | Feitiço | custo 3, recarga 3 s, cura 4 |
| `moonlit-mage` | MOONLIT MAGE | Criatura | nível 2, custo 5, recarga 3 s, dano 3 |
| `ember-sprite` | EMBER SPRITE | Criatura | nível 1, custo 2, recarga 1,5 s, dano 1 |
| `tide-guardian` | TIDE GUARDIAN | Criatura | nível 2, custo 4, recarga 4 s, dano 2 |
| `thorn-beast` | THORN BEAST | Criatura | nível 2, custo 3, recarga 2 s, dano 2 |
| `starfall` | STARFALL | Feitiço | custo 2, recarga 2 s, dano 3 |
| `arcane-barrier` | ARCANE BARRIER | Feitiço | custo 3, recarga 4 s, escudo 3 |
| `verdant-bloom` | VERDANT BLOOM | Feitiço | custo 2, recarga 2 s, cura 3 |
| `sacred-font` | SACRED FONT | Feitiço | custo 5, recarga 5 s, cura 6 |
| `iron-ward` | IRON WARD | Feitiço | custo 2, recarga 2 s, escudo 2 |
| `aegis-totem` | AEGIS TOTEM | Feitiço | custo 5, recarga 5 s, escudo 5 |
| `pack-alpha` | PACK ALPHA | Criatura | nível 2, custo 4, recarga 4 s, dano 2; dá +2 às criaturas adjacentes |
| `tide-totem` | TIDE TOTEM | Equipamento | custo 4; reduz em 30% a recarga da carta à direita |
| `soul-link` | SOUL LINK | Feitiço | custo 3, recarga 3 s, cura 2; +2 ao efeito da carta à esquerda |
| `time-crystal` | TIME CRYSTAL | Equipamento | custo 4; haste de valor +0,12/s para o próprio lado |
| `swift-gear` | SWIFT GEAR | Equipamento | custo 4; haste de recarga +0,5/s para o próprio lado |
| `hex-chain` | HEX CHAIN | Equipamento | custo 5; haste inimiga de valor +0,09/s e recarga +0,06/s |

### Tiers, fusão e coringas

- Tier pertence à instância da carta, não altera a definição do catálogo. Há seis
  tiers (D a SS; nomes visuais de Bronze a Obsidiana).
- O sorteio de tiers (loja/aventura) tem viés para os baixos: D 34%, C 28%,
  B 20%, A 11%, S 5,5% e SS 1,5%.
- Fusão consome uma duplicata e aumenta um tier na carta-alvo, limitado ao tier
  máximo. Duplicatas podem ser arrastadas uma sobre a outra fora do combate.
- Cada vitória concede um coringa de tier progressivo. Há três espaços; quando
  excedidos, são preservados os três coringas de maior tier. Selecionar um e
  clicar numa carta aplica o tier-alvo fora de combate.
- Cada tier adiciona aproximadamente 30% ao valor de dano/cura/escudo e reduz
  em 8% a recarga, com mínimo de 0,5 s.

### Especialidades dos magos

NEON especializa-se em dano e aceleração; ÁUREA em cura e aceleração; FERRO em
escudo e dano. Cartas da categoria de especialidade recebem, no deck do mago,
50% a mais de valor, recarga 15% menor e 40% a mais de haste do equipamento.
Esse ajuste é aplicado à cópia usada pelo jogo, sem mudar a definição base do
catálogo.

### Passivas de mago (tabuleiro)

Além das especialidades, cada mago tem uma passiva própria (`src/lib/passives.ts`),
visível e sutil no tabuleiro do jogador:

| Mago | Passiva | Efeito |
| --- | --- | --- |
| NEON | NÚCLEO DE GUERRA | A carta no **slot 3** ganha +5% de atributos e −10% de recarga (mais aceleração). Aura âmbar no slot. |
| ÁUREA | RESSONÂNCIA | Dois itens de **cura adjacentes** têm ambos ×1,2 no valor. Brilho na carta. |
| FERRO | MURALHA | Com **2+ itens de escudo na mão**, a vida máxima é ×2. Badge "MURALHA ×2" na barra de vida. |

A vida máxima efetiva (com MURALHA) é usada na inicialização de cada combate e no
teto de cura, para o jogador e, quando o oponente é uma build real, também para
ele (o snapshot carrega a vida máxima já calculada).

### Vozes dos magos

Cada mago tem três falas em `public/sounds/mages/<mago>/<MAGO>_<FALA>.mp3`:
`SYDRA`, `AURORA` e `EGBERT`, com `INTRO`, `CARD_PLACE` e `BATTLE_STARTS`. A
camada é `src/lib/mage-voice.ts`.

| Fala | Quando toca |
| --- | --- |
| `INTRO` | Fase nova (loja e aventura), seleção de mago no menu e na tela de magos, e abertura do menu. |
| `CARD_PLACE` | Ao posicionar uma carta no tabuleiro, com 30% de chance. |
| `BATTLE_STARTS` | Início do combate (`chooseBot` e `startVersus`). Nas fases `bot` e `player` a `INTRO` não toca. |

Detalhes que importam:

- O caminho sai do **nome de exibição** do mago (`SYDRA` → `/sounds/mages/
  sydra/SYDRA_INTRO.mp3`), não do id interno, que é outro (`neon`, `aurea`,
  `ferro`).
- As falas **não passam pelo patch de áudio**: são trilha narrativa, sem
  biblioteca nem binding no painel. Respeitam o slider de EFEITOS do jogador,
  com volume relativo por fala (0,9 / 0,7 / 0,9).
- Um guarda de 2,5 s impede repetir a mesma fala em sequência — sem ele, a
  saudação do menu e a primeira fase da run se sobrepõem.
- A saudação de abertura do menu acontece no mount, antes de qualquer gesto, e
  o navegador bloqueia áudio até lá. A fala é **adiada** para o primeiro gesto
  (`playOrDefer`), com janela de 10 s para não tocar tarde demais.
- As falas dividem um **canal exclusivo** (`mage-voice`): tocar uma corta a
  anterior, para dois magos nunca falarem por cima um do outro. O canal é
  opt-in em `playPath` — efeitos de combate seguem se sobrepondo de propósito,
  porque várias cartas podem disparar no mesmo frame. Reiniciar a run
  (`restartRun`) cala a voz e limpa o guarda de repetição.

### Som da carta

Cada carta pode ter um som no disparo do cooldown do combate. A escolha é feita
na **aba Sons** do painel (`/admin`), não no editor de cartas, porque o som
precisa de volume e intervalo próprios. A chave é `card:<cardId>`; um binding
salvo tem prioridade sobre o campo `sound` legado da definição.

Enquanto não houver binding salvo, o jogo deriva o som do efeito da carta (o
comportamento antigo, preservado): cura → `heal`, escudo → `shield`, equipamento
→ `haste`, demais → `attackBlast`. Cartas sem binding usam volume 55% e
intervalo mínimo de 120 ms. Ver a seção 7.1.

## 6. Combate e feedback visual

- Cada carta invocada que causa dano, cura ou escudo dispara em ciclos
  independentes. Equipamentos não disparam; modificam as taxas de haste.
- O valor das cartas cresce com o tempo de batalha a uma taxa base de 6% por
  segundo. Equipamentos próprios podem aumentar haste de valor/recarga; os
  equipamentos direcionados ao inimigo reduzem as taxas do oponente.
- O cálculo é atualizado a cada frame. O cooldown efetivo diminui conforme a
  haste e nunca fica abaixo de 0,5 s.
- Sinergias de adjacência concedem bônus de valor ou multiplicador de cooldown
  ao vizinho elegível.
- Dano atinge a vida do lado adversário; cura e escudo afetam o próprio lado.
  Dano consome escudo antes de vida. **A cura não tem teto:** o que passaria da
  vida máxima não se perde, vira vida máxima. Com 100 de vida e uma cura de 60
  em cima, o jogador fica em 160 de 160. A vida máxima é a vida *inicial* da
  batalha; o ganho conquistado com cura vale só dentro dela e zera na fase
  seguinte (`chooseBot`, `startVersus` e `enterPhase` limpam
  `playerMaxHealthGain`/`opponentMaxHealthGain`). Vale para os dois lados.
  O escudo não tem teto.
- A passiva MURALHA dobra a **base** da vida máxima, não o ganho de cura: com
  MURALHA ativa e 60 de ganho, o teto é 260, não 320. Caso contrário a carta de
  cura renderia o dobro do seu valor em vida máxima.
- No início de **cada combate**, ambos os lados começam na vida máxima atual e
  com escudo zerado. A base é 50, mas o jogador pode ter mais (aventura de +vida
  ou a passiva MURALHA ×2) e o oponente usa `opponentMaxHealth` (a vida máxima da
  build real, quando for PVP assíncrono). O estado de vida/escudo não transita
  entre batalhas, e o ganho de cura também não.
- A `HealthBar` do **oponente** usa `opponentMaxHealth` (não `config.maxHealth`),
  para não limitar a exibição da vida dele quando o rival tem mais que o padrão.
- Ao disparar, cada carta toca seu som (`playCardSound`): ataque
  (sword/pistol/blast), cura, escudo ou — para equipamentos de aceleração — um
  aviso único de haste no início da batalha. A névoa também emite um alerta.
- A névoa começa aos 60 segundos, avisa 8 segundos antes e depois aplica dano
  progressivo a ambos os lados, aumentando 1 de dano por segundo. Ela ignora
  escudo e encerra batalhas demoradas.
- A batalha acaba quando uma vida chega a zero. Vitória/derrota mostra um modal
  com ação para continuar ou reiniciar.

Feedback de combate inclui preenchimento de cooldown, atualização dos valores
efetivos, flash ao disparar, projéteis cosméticos de dano, popups flutuantes e
realces nas barras. Dano recebido é vermelho; cura, verde; escudo, amarelo.
As barras de vida são verdes e a barra do oponente só aparece em combate.

As descrições de algumas cartas ainda prometem efeitos não implementados. A
regra efetiva é definida pelos campos mecânicos da carta e pelo motor de
combate; não assuma retorno à mão ou dano em área só por causa do texto.

## 7. Arte e apresentação de cartas

- As artes originais ficam em `src/boargame/img/` como referência e as usadas
  pelo Next são servidas por `public/boargame/img/`.
- Cartas podem usar imagem ou vídeo em loop, mudo e inline. Sem arte fixa,
  `artFor` escolhe as artes conforme as regras atuais (incluindo vídeos dos
  magos para feitiços). Por performance, o vídeo só toca **em hover**; parada, a
  carta mostra o pôster (ver seção 1, Anatomia da carta).
- O modal de detalhes abre por clique e fecha pelo botão, backdrop ou `Escape`.
- A prévia da seleção de mago esconde tiers; em loja, aventura e combate os tiers
  e seus atributos visuais permanecem disponíveis.

### 7.1 Áudio e efeitos sonoros

A camada de áudio está em `src/lib/sfx.ts`, e o contrato em `src/lib/audio.ts`.
Nada é hardcoded: som, volume e intervalo vêm de `GET /api/audio`, que serve o
patch de áudio publicado. `SoundProvider` (montado no layout) busca a config uma
vez por sessão e **destrava o áudio no primeiro gesto real do usuário** — sem
isso o navegador rejeita todo `play()` e nenhum efeito toca.

- **Eventos nomeados.** Cada som disparado tem uma chave: `event:<nome>` para
  eventos do jogo (`event:dice`, `event:buy`, `event:fog`…), `ui:<tela>.<acao>`
  para interface (`ui:menu.play`, `ui:modal.close`, `ui:admin.save`…) e
  `card:<cardId>` para cartas. O registro completo, com rótulo e descrição do
  gatilho, está em `AUDIO_EVENTS` (`src/lib/audio.ts`).
- **Binding.** Uma chave aponta para um som da biblioteca e define `volume`
  (0..1, a mixagem do evento), `minIntervalMs` (não repetir mais rápido que isso)
  e `enabled`. `soundId` nulo deixa o evento mudo.
- **Mixagem.** O volume final é `volume do binding × slider de efeitos do
  jogador` (Ajustes). O slider continua global e multiplica tudo.
- **Cartas.** Binding salvo vence; sem binding, vale o som derivado do efeito
  (ver seção 5). O disparo continua no `fire()` do motor de combate.
- **Reprodução.** Pool de 4 `HTMLAudioElement` por arquivo, em round-robin, com
  `currentTime` zerado — evita que rajadas de cartas ou hovers criem players
  concorrentes competindo pelo mesmo download. A chave do pool inclui o caminho,
  então trocar o arquivo no patch não continua tocando o antigo.
- **Ajustes.** O `SettingsModal` (item AJUSTES no menu) controla os volumes de
  música e efeitos; ambos persistem em `localStorage`. O `BackgroundMusic` lê o
  volume de música e não tem botão de mudo.
- **Arquivos.** `public/sounds/` tem `dice/`, `itens/` e `ui/`. Uploads novos
  vão para `public/sounds/upload/` e **só existem em desenvolvimento**; para
  aparecer em produção, o arquivo precisa ser commitado no Git.
- **Temas de fundo.** `src/lib/backgrounds.ts` associa cada vídeo de fundo a uma
  trilha; o par é sorteado a cada carregamento do menu e sincronizado entre
  vídeo e música.

## 8. Editor de balanceamento

O painel fica em `/admin` e tem duas abas independentes, cada uma com seu
próprio patch, rascunho e publicação: **CARTAS** (balanceamento) e **SONS**
(áudio). Autenticação por senha compartilhada nos dois casos.

**Criar cartas novas não faz parte do escopo atual.** Na aba CARTAS dá para
buscar por nome/ID/caminho de arte, filtrar por tipo, editar cartas existentes,
arquivar/restaurar e criar/publicar patches.

### Aba Sons

Duas listas sobre o patch de áudio:

- **Biblioteca**: os arquivos (`id`, rótulo, caminho, categoria) e o upload
  local. Criar um som novo, renomear, reativar ou remover. Remover um som
  silencia os eventos que o usavam, em vez de apagá-los.
- **Eventos**: cada evento nomeado — do jogo, da interface e das cartas — com
  arquivo, volume, intervalo mínimo, liga/desliga e um botão **TESTAR** que toca
  na hora. O TESTAR toca o **rascunho da linha**, não o patch publicado: o que
  se ouve é o que está na tela. Com volume em 0 o botão fica desabilitado e
  diz "Volume 0 — evento mudo". As cartas vêm do patch de cartas publicado,
  então a lista acompanha o catálogo automaticamente. Cartas sem binding salvo
  mostram "herdado do efeito da carta" e usam o valor padrão do runtime.
- **OUVIR ARQUIVO**, no editor da biblioteca, é outra coisa: toca o arquivo cru
  a 100%, sem a mixagem de nenhum evento. Serve para conferir se o arquivo
  escolhido é o certo.

Nada vale no jogo até **PUBLICAR PATCH**.

### Patches e catálogo ativo

- A migration em `supabase/migrations/20260601000000_balance_editor.sql` cria
  `balance_patches` e `balance_patch_cards`, habilita RLS, insere as 19 cartas e
  publica o patch inicial.
- A migration em `supabase/migrations/20260601000001_audio_editor.sql` cria
  `audio_patches`, `audio_patch_sounds` e `audio_patch_bindings`, publica o patch
  de áudio inicial com a biblioteca atual e registra `publish_audio_patch()`.
  **Rode as duas migrations**; sem a de áudio, a aba Sons abre em modo somente
  leitura com a biblioteca local e o jogo usa os padrões.
- Criar um rascunho copia as definições do patch publicado. Salvar mudanças
  afeta apenas esse rascunho.
- Publicar exige confirmação visual e troca o patch ativo em uma operação
  transacional. O patch publicado anterior fica arquivado para preservar o
  histórico. Cartas e som publicam separadamente, porque mudam em ritmos
  diferentes.
- Arquivar uma carta é reversível. Ela sai das ofertas da loja e da aventura,
  mas a definição permanece disponível para decks existentes de NPCs/rivais.
- `GET /api/catalog` fornece ao jogo as cartas do patch publicado. Em produção,
  a ausência de credencial server-only ou uma falha de leitura do banco retorna
  erro explícito; o catálogo local é fallback apenas em desenvolvimento sem
  chave configurada.
- `GET /api/audio` fornece a configuração de áudio publicada. Ela nunca bloqueia
  o jogo: qualquer falha cai na biblioteca local padrão.

### Configuração

Use `.env.example` como modelo e configure os valores localmente em `.env.local`
ou no ambiente de deploy:

| Variável | Uso |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase. |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Chave pública do projeto. |
| `SUPABASE_SERVICE_ROLE_KEY` | Credencial privilegiada usada exclusivamente no servidor. |
| `ADMIN_PASSWORD` | Senha compartilhada para entrar no painel. |
| `ADMIN_SESSION_SECRET` | Segredo de assinatura do cookie, com pelo menos 32 caracteres. |

Nunca publique nem prefixe com `NEXT_PUBLIC_` as variáveis server-only. A senha
é trocada por um cookie assinado e `HttpOnly`; não é necessário colar segredos
no chat.

### Contas de jogador

O cadastro e o login usam Supabase Auth com email e senha. O cadastro também
solicita um nome de jogador, armazenado em `user_metadata.display_name`. O ID
do último mago usado em uma run fica em `user_metadata.last_mage_id`; ele só é
atualizado ao iniciar uma run. A conclusão do tutorial fica em
`user_metadata.tutorial_done` (gravado ao concluir ou pular a run guiada). O
perfil não exige tabela ou migration extra.
Sem histórico de partida, a tela inicial mostra um mago aleatório como badge.

O menu permite abrir o formulário de entrada/cadastro, e `/play` verifica a
sessão antes de carregar o jogo. A galeria `/magos` continua pública. Se a
confirmação de email estiver habilitada no Supabase, o jogador recebe uma
mensagem para confirmar o endereço antes de entrar. Ative o provedor Email em
**Authentication → Sign In / Providers** e configure a URL local/de produção
em **Authentication → URL Configuration**. A chave publishable é usada apenas
no cliente; a service-role permanece exclusiva do servidor.

Se o PostgREST informar que não encontra uma tabela recém-criada, confirme que a
migration foi aplicada ao mesmo projeto indicado pela URL e atualize o cache de
schema no SQL Editor:

```sql
NOTIFY pgrst, 'reload schema';
```

### PVP assíncrono (snapshots) e placar de líderes

Dois scripts avulsos (fora de `migrations/`) precisam ser rodados uma vez no SQL
Editor do Supabase:

- `supabase/build_snapshots.sql` — tabela `build_snapshots` (uma linha por
  confronto de rival: `user_id`, `display_name`, `mage_id`, `pass` 1–3,
  `max_health`, `slots` jsonb e `catalog_version`). RLS permite ao jogador
  inserir apenas os próprios snapshots; a leitura é só pelo backend.
- `supabase/leaderboard.sql` — tabela `leaderboard` (uma linha por jogador, via
  **upsert** em `user_id`: `display_name`, `mage_id`, `victories`, `completed`,
  `slots`, `updated_at`). RLS permite inserir/atualizar só a própria linha.
- `supabase/migrations/20260601000002_leaderboard_build.sql` — acrescenta a
  coluna `slots` (jsonb) com a **build final da run**: as 4 posições, cada uma
  `{cardId, tier}` ou `null`. É o que `/leaderboard` desenha abaixo de cada
  jogador. Até a migration rodar, a rota detecta a coluna ausente (`42703`) e
  volta a ler/gravar sem a build, em vez de derrubar o placar.

Fluxo:

- A cada clique em LUTAR na fase de rival, o cliente grava um snapshot da build
  atual (`src/lib/snapshots.ts`, via RLS). São até 3 por run.
- Ao entrar na fase de rival, `GET /api/snapshots?pass=N&exclude=<uid>` sorteia a
  build de outro jogador do mesmo pass (service role), excluindo o próprio.
  Vazio → fallback para o rival estático.
- No fim da run, `BattleResult` grava o resultado no placar
  (`src/lib/leaderboard.ts`): **vale sempre a última run** (upsert). `GET
  /api/leaderboard` devolve o ranking (concluiu → vitórias → mais recente),
  exibido em `/leaderboard`.

Sem `SUPABASE_SERVICE_ROLE_KEY` as rotas devolvem vazio e o jogo usa os rivais
estáticos; para gravar, o jogador precisa estar logado.

### Arte customizada

O editor aceita caminho público ou URL HTTPS. Upload local é habilitado apenas
em desenvolvimento, aceita PNG/JPEG/WebP/GIF até 8 MB e grava em
`public/card-art/`. O banco guarda o caminho, não o arquivo. Para que a arte
apareça em produção, adicione o arquivo ao Git e faça deploy; o filesystem do
servidor de produção não é usado para upload.

O mesmo vale para som: o upload da aba Sons aceita MP3/WAV/OGG/FLAC/M4A até
8 MB, grava em `public/sounds/upload/` e devolve o caminho. O arquivo precisa
ser commitado no Git para existir no deploy.

## 9. Estado online e itens planejados

**Implementado:** catálogo versionado no Supabase, editor autenticado, patches
com publicação explícita, cadastro/login de jogadores via Supabase Auth, perfil
com último mago usado, passivas de mago, pré-seleção de mago no menu,
**configuração de áudio versionada** (biblioteca de sons, eventos nomeados por
tela, volume e intervalo mínimo por evento, som por carta, botão de teste) com
ajustes de volume do jogador, temas de fundo vídeo+trilha, **PVP assíncrono
por snapshots** na fase de rival, **placar de líderes** (última run de cada
jogador) e um **tutorial guiado** (APRENDER MAGGI) que ensina um ciclo completo
com anel de destaque e avanço por ação (ver seção 3.1). Os NPCs da fase de bot
continuam sendo builds locais estáticos.

**Ainda não implementado:**

- Player Rank e temporada ranqueada;
- partidas em tempo real (o design é assíncrono, por snapshots);
- criação de cartas pelo painel;
- persistência da run do jogador entre recarregamentos;
- substituição dos NPCs da fase de bot por builds de jogadores reais (hoje só a
  fase de rival usa snapshots).

Esses recursos precisam de decisões e implementação próprias.

## 10. Referência standalone preservada

Não apagar, mover ou sobrescrever `src/boargame/`. Os arquivos principais são:

| Arquivo | Referência |
| --- | --- |
| `src/boargame/board.html` | Estrutura original do tabuleiro, cartas e modais. |
| `src/boargame/board.css` | Geometria CSS 3D, layout e animações originais. |
| `src/boargame/board.js` | Primeira implementação local das regras e dados. |
| `src/boargame/img/` | Artes e mídia originais. |

Para reconstruir a referência standalone, use HTML/CSS/JS e os assets originais.
Para alterar o jogo que roda atualmente, trabalhe no app Next.js e preserve a
versão standalone como registro histórico.

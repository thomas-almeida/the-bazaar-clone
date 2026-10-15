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
para o build de produção.

## 2. Estrutura e fontes de verdade

| Caminho | Responsabilidade |
| --- | --- |
| `app/page.tsx` | Menu principal e navegação. |
| `app/play/page.tsx` | Carrega o catálogo e inicia o fluxo de jogo. |
| `app/magos/page.tsx` | Galeria de magos e prévia dos decks. |
| `app/admin/page.tsx` | Editor administrativo de cartas e patches. |
| `app/api/catalog/route.ts` | Serve o catálogo ativo para o jogo. |
| `app/api/admin/` | Sessão administrativa, patches, edição e upload de arte. |
| `app/globals.css` | Tailwind CSS v4, layout do tabuleiro e estilos da interface. |
| `src/lib/catalog.ts` | Catálogo local de cartas, configuração e builds de NPCs/rivais. |
| `src/lib/store.ts` | Estado da run, transições de fase, lojas e efeitos de combate. |
| `src/lib/` | Tipos, artes, magos, tiers, sinergias, haste e névoa. |
| `src/hooks/useCombatEngine.ts` | Ciclos de combate, haste, popups, projéteis e névoa. |
| `src/components/` | Tabuleiro, cartas, HUD, modais, mão e telas. |
| `supabase/migrations/` | Schema e catálogo inicial do editor de balanceamento. |
| `public/boargame/img/` | Artes e mídia servidas pela aplicação Next.js. |
| `src/boargame/` | Referência standalone original; preservar. |

O app usa **Next.js App Router, React, TypeScript, Zustand e Tailwind CSS v4**.
Tailwind v4 é uma dependência necessária para futuras edições manuais de UI.

O tabuleiro permanece construído em HTML/CSS com geometria **CSS 3D**; não é
renderizado com React Three Fiber. `src/boargame/board.html`, `board.css`,
`board.js` e seus assets continuam sendo uma referência útil, mas a aplicação
ativa agora está em `app/` e `src/`.

## 3. Experiência visual e navegação

- **Menu:** usa vídeo de fundo com blur/overlay, logo, botões e trilha sonora.
  O botão de música silencia/reativa o áudio; o volume muda entre menu e jogo.
- **Tela cheia:** no primeiro acesso aparece um modal para ativar fullscreen ou
  salvar a preferência de não mostrá-lo novamente.
- **Magos:** há três opções — NEON, ÁUREA e FERRO — com tema, retrato e
  especialidades. A galeria apresenta as cartas sem expor tier/nível; no jogo,
  as insígnias e cores de tier continuam visíveis.
- **Tabuleiro:** mantém a mesa em perspectiva, fileira superior contextual,
  quatro slots de jogador, barras de vida/escudo, console de dado/mana e mão em
  leque no canto inferior direito.
- **Cartas:** a mão permite hover com elevação e tilt 3D, seleção por clique,
  drag-and-drop, fusão de duplicatas e uso de coringas fora do combate.
- **Breakpoints:** a composição original tem referência visual em 1920×1080.
  Há ajustes responsivos na app, mas o alvo principal de fidelidade continua
  sendo a composição de desktop.
- **Rolagem:** usa uma scrollbar flat e discreta.

A intenção é preservar o visual do protótipo sem mudar proporções do tabuleiro
para resolver problemas de layout. Melhorias de interface são acrescentadas
fora da geometria aprovada.

## 4. Loop de jogo atual

O fluxo é uma sequência local determinística de **três voltas**, cada uma com
esta sequência de nove fases:

| Ordem na volta | Fase | O que acontece |
| ---: | --- | --- |
| 1 | Loja | Compras/preparação e rolagem obrigatória do dado. |
| 2 | Roleta | Sorteio de três cartas; escolher uma é opcional. |
| 3 | Farm/NPC | Combate automático contra um build local aleatório. |
| 4 | Loja | Nova preparação. |
| 5 | Roleta | Novo sorteio de cartas; escolha opcional. |
| 6 | Farm/NPC | Segundo combate automático contra NPC. |
| 7 | Roleta | Novo sorteio; escolha opcional. |
| 8 | Loja | Última preparação da volta. |
| 9 | Rival local | Combate automático contra um build rival predefinido. |

Ao todo, uma run tem nove fases de loja, nove roletas, seis combates contra NPC
e três combates contra rival local. Ao vencer um combate, **CONTINUAR** avança
para a próxima fase e concede um coringa. Perder encerra a tentativa e oferece
reiniciar. Vencer o último rival conclui a run.

### Loja e roleta

- As lojas são separadas por categoria: dano, cura, aceleração e escudo. Cada
  categoria oferece até três cartas aleatórias do catálogo ativo.
- A moeda está em modo de teste: mana infinita e preço exibido de 1 por oferta.
  O custo normal continua nos dados da carta, mas não é cobrado nessa
  configuração.
- A rolagem do dado é exigida para avançar de uma fase de loja. Com mana
  infinita, o valor não afeta compras.
- A configuração declara limite normal de mão 7, mas a inicialização atual do
  jogo sobrescreve esse valor para 999. Portanto, na prática, não há o limite
  normal de sete cartas nesta build de teste.
- A roleta apresenta três cartas com tiers sorteados, favorecendo tiers
  baixos. É permitido avançar sem escolher uma delas.
- As lojas e roletas não iniciam combate. Cartas podem ser organizadas no
  tabuleiro fora do combate.

### NPCs e rivais

Os adversários são builds locais; ainda não são snapshots de usuários nem
partidas online. Os decks são resolvidos por IDs estáveis, portanto renomear
uma carta não quebra as referências dos builds.

| Build | Cartas |
| --- | --- |
| MAGO DAS BRASAS | EMBER SPRITE, PHOENIX LORD, ARCANE BARRIER |
| ORÁCULO DA MARÉ | TIDE GUARDIAN, HEALING RAIN, ARCANE BARRIER |
| DRUIDA DO BOSQUE | THORN BEAST, MOONLIT MAGE, ARCANE BARRIER |
| DUELISTA DAS CINZAS | EMBER SPRITE, DRAGON WHELP, PHOENIX LORD, STARFALL |
| GUARDIÃ DA MARÉ | TIDE GUARDIAN, HEALING RAIN, MOONLIT MAGE, ARCANE BARRIER |
| CAMPEÃO DO BOSQUE | THORN BEAST, MOONLIT MAGE, PHOENIX LORD, HEALING RAIN |

Em cada combate, o build é sorteado de acordo com o tipo da fase. A dificuldade
visual/mecânica do oponente recebe o tier correspondente à volta atual, limitado
ao tier máximo.

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
- A roleta sorteia tiers com viés para os baixos: D 34%, C 28%, B 20%, A 11%,
  S 5,5% e SS 1,5%.
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
  Dano consome escudo antes de vida. Cura é limitada à vida máxima; o escudo não
  tem teto explícito.
- No início de **cada combate**, ambos os lados começam na vida máxima atual
  (50) e com escudo zerado. O estado de vida/escudo não transita entre batalhas.
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
  magos para feitiços).
- O modal de detalhes abre por clique e fecha pelo botão, backdrop ou `Escape`.
- A prévia da seleção de mago esconde tiers; em loja, roleta e combate os tiers
  e seus atributos visuais permanecem disponíveis.

## 8. Editor de balanceamento

O painel fica em `/admin`. Ele permite autenticação por senha compartilhada,
buscar por nome/ID/caminho de arte, filtrar por tipo, editar cartas existentes,
arquivar/restaurar cartas e criar/publicar patches. **Criar cartas novas não faz
parte do escopo atual.**

### Patches e catálogo ativo

- A migration em `supabase/migrations/20260601000000_balance_editor.sql` cria
  `balance_patches` e `balance_patch_cards`, habilita RLS, insere as 19 cartas e
  publica o patch inicial.
- Criar um rascunho copia as definições do patch publicado. Salvar mudanças
  afeta apenas esse rascunho.
- Publicar exige confirmação visual e troca o patch ativo em uma operação
  transacional. O patch publicado anterior fica arquivado para preservar o
  histórico.
- Arquivar uma carta é reversível. Ela sai das ofertas da loja e da roleta,
  mas a definição permanece disponível para decks existentes de NPCs/rivais.
- `GET /api/catalog` fornece ao jogo as cartas do patch publicado. Em produção,
  a ausência de credencial server-only ou uma falha de leitura do banco retorna
  erro explícito; o catálogo local é fallback apenas em desenvolvimento sem
  chave configurada.

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

Se o PostgREST informar que não encontra uma tabela recém-criada, confirme que a
migration foi aplicada ao mesmo projeto indicado pela URL e atualize o cache de
schema no SQL Editor:

```sql
NOTIFY pgrst, 'reload schema';
```

### Arte customizada

O editor aceita caminho público ou URL HTTPS. Upload local é habilitado apenas
em desenvolvimento, aceita PNG/JPEG/WebP/GIF até 8 MB e grava em
`public/card-art/`. O banco guarda o caminho, não o arquivo. Para que a arte
apareça em produção, adicione o arquivo ao Git e faça deploy; o filesystem do
servidor de produção não é usado para upload.

## 9. Estado online e itens planejados

**Implementado:** catálogo versionado no Supabase, editor autenticado, patches
com publicação explícita e builds adversários locais.

**Ainda não implementado:**

- cadastro/login de jogadores, perfil persistente ou Player Rank;
- placar de líderes e temporada;
- gravação de runs, snapshots de builds por dia/etapa e fila de oponentes
  baseada em jogadores reais;
- partidas em tempo real (o design pretendido é assíncrono, por snapshots);
- criação de cartas pelo painel;
- efeitos sonoros de combate ou controles de áudio além da música de fundo;
- persistência da run do jogador entre recarregamentos.

Esses recursos precisam de decisões e implementação próprias. Os NPCs e rivais
atuais não representam dados de usuários nem matchmaking.

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

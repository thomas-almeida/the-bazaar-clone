# GDD — Auto-battler de Elementos

## 1. Visão
Auto-battler em rodadas, inspirado em *The Bazaar*. O jogador escolhe um personagem elemental (Fogo, Água ou Grama) que já começa com um deck fixo. A cada rodada ele ganha mana, compra cartas numa loja, monta o tabuleiro e assiste sua build batalhar automatica contra monstros bots e a uma batalha automática contra jogadores reais em um gameplay loop, o jogador vence se completar 3 vitórias contra um player nesse loop, se perder contra um player no meio do caminho a run acaba.

- **Partida:** 1 jogador contra 1 bot.
- **HP inicial:** 100 para cada lado.
- **Fantasia:** montar um "motor" de criaturas e terrenos de um elemento só e ver a build ganhar sozinha.

## 2. Loop de jogo (uma rodada)
```
LOJA + DADO → FARM (MAGO NPC) → PLAYER RANKED → próxima rodada
```
1. **Loja:** o tabuleiro superior vira o bazar e exibe de 1 a 4 ofertas; o fundo usa a arte de tapete. A etiqueta lateral identifica o contexto atual.
2. **Dado e mana:** na fase de loja, rolar o D6 adiciona o resultado à mana, que acumula entre rodadas até o teto de 10. A mana aparece em 10 quadrados azuis acima da base do dado, com o valor atual e máximo no formato `atual/10`.
3. **Compra e preparação:** cartas compradas vão para a mão (no protótipo, o preço temporário da loja é 1 mana). Ofertas ficam com brilho branco quando o jogador tem mana para comprá-las e espaço na mão; arrastá-las para a mão efetua a compra, enquanto clicar abre os detalhes. Invocar uma carta da mão no tabuleiro custa a mana indicada nela; cartas sem mana suficiente ficam em preto e branco e não podem ser arrastadas para o tabuleiro, enquanto cartas possíveis de invocar ficam coloridas e com borda branca brilhante. A mão comporta até 7 cartas. Esta é a única fase em que se compra e joga cartas no tabuleiro.
4. **Farm:** o tabuleiro superior mostra um mago NPC com um deck predefinido de 3 cartas, ocupando 3 dos 4 slots. Há três variações — Mago das Brasas, Oráculo da Maré e Druida do Bosque —; as cartas usam o mesmo visual, recarga e animações das cartas do jogador. A batalha começa ao avançar da loja.
5. **Player ranked:** após vencer o mago, o botão de continuar inicia uma batalha contra uma build snapshot de outro jogador. A build usa quatro slots com as mesmas cartas, apresentação e animações de recarga do tabuleiro do jogador; não é uma batalha online em tempo real.
6. **Resolução de batalha:** cada combatente começa o confronto com 100 de vida. Durante a batalha, os cooldowns ativam os efeitos das cartas: dano reduz a vida do oponente e consome escudo antes, cura recupera até 100 de vida e escudo acumula para absorver dano. As barras mostram vida e escudo; cooldowns e popups de dano, cura e escudo ficam inativos fora de combate. A vida do jogador persiste entre lutas da run.
7. **Vitória e derrota:** quando a vida de um combatente chega a zero, a batalha para e aparece o resultado. Vencer o Farm permite continuar para o Rival; vencer o Rival inicia a próxima fase de loja. Perder permite reiniciar a run, restaurando vida, mana e cartas iniciais.

## 3. Personagens
| Personagem | Deck inicial |
|---|---
| **Fogo** | MOB fraco, MOB medio, MOB forte, Carta de terreno do elemento, Contrução fraca, contrução media, contrução forte  
| **Água** | MOB fraco, MOB medio, MOB forte, Carta de terreno do elemento, Contrução fraca, contrução media, contrução forte
| **Grama** | MOB fraco, MOB medio, MOB forte, Carta de terreno do elemento, Contrução fraca, contrução media, contrução forte

## 4. Tabuleiro
- A grade tem 3 colunas × 4 linhas. Cada lado fica com 6 casas: uma **linha de frente** e uma **linha de trás**.
- Uma criatura pode ser invocada em qualquer uma das 6 casas do próprio lado, mas apenas onde tiver um terrno daquele elemento.
- O tabuleiro do rival fica **oculto** fora da batalha e so aparece na fase em que deve-se enfrentar um player, nas fases de farm contra player bots ai ele aparece.
- **Terreno:** pinta uma casa com um elemento e pode ser repintado por cima. Hoje ele é só visual e não dá atributo (ver Roadmap), colocar um terreno duplicado ou seja dois iguais na mesma tile deve dar algum bonus do elemento para o mob ou construção que estiver nela.

## 5. Loja e economia
- A loja deve dar itens novos que dao bonus aos personagens, itens universais mas que tenham atributos especiais para cada um dos elementos isso para que os itens sejam de conhecimento geral como em jogos como lol e dota.
- **Preço = custo da carta.**
- **Preço temporário de teste:** no protótipo, todos os itens da loja custam 1 de mana; o custo impresso na carta permanece inalterado.
- O pagamento sai da mana, que é a única moeda do jogo. comprar um itens bonus de bonus deve adicionar a mao do jogador, ele pode equipar em mobs, construções ou nos terrenos vazios
- Itens da loja nao tem custo de mana para serem jogados como as cartas de mobs ou contruções, terrenos nao tem custo também.

| Constante | Valor |
|---|---|
| HP do jogador | 100 |
| Mana por rodada | 1d6 |
| Teto de mana | 10 |
| Ofertas na loja | 3 |

No protótipo, o número de ofertas é variável (1 a 4), para validar o tabuleiro modular.

## 6. Fase de Farm
- O tabuleiro superior recebe um dos três magos NPC predefinidos. Cada um usa um deck fixo de 3 cartas em um tabuleiro de 4 slots, com as mesmas cartas e animações de recarga do jogador.
- Toda criatura do tabuleiro do player dá **5 tiros**, cada um com dano igual ao ATK dela, sempre no mob da frente da fila.
- **Recompensa por abate:** mana igual a ⌊HP do mob / 2⌋.
- **Bônus elemental:** vale **por criatura** do elemento em campo, com teto de 3 por elemento.
  - Fogo: +1 ATK.
  - Água: +1 DEF.
  - Grama: cura o jogador em 1.
  - O farm é uma fase de adquiri mana e preparação antes das lutas com jogadores

## 7. Batalha
- As criaturas **não lutam entre si**. Cada uma causa seu *dano por tiro* direto no HP do jogador inimigo a cada *cooldown* em segundos. Todas começam a batalha já prontas para atirar.
- No tabuleiro, a carta preenche sua barra em branco de baixo para cima ao longo do cooldown, enquanto a arte recupera brilho e saturação. Ao completar a carga, a borda pisca em branco e as cartas com dano mostram brevemente o valor do ataque acima delas, com animação de bounce. Na mão, a arte fica colorida e sem animação de recarga. O HP só cai quando o tiro acerta.
- itens da loja que dão **Escudos** reduzem o dano recebido pelo jogador:

## 8. Cartas

### Criaturas
Na carta, os valores destacados são custo, dano por tiro e cooldown, além do nível (fraco = 1, médio = 2, forte = 3). DEF continua sendo um atributo de jogo, mas não ocupa um dos três valores de combate mostrados na carta.

| Carta | Elem. | Custo | ATK/DEF | Dano / cooldown
|---|---|---|---|---|
| Mob Agua Fraco | Água | 1 | 1/1 | 1 / 4s 
| Mob Fogo Fraco | Fogo | 2 | 1/1 | 2 / 3s 
| Mob Grama Fraco | Grama | 2 | 1/1 | 3 / 3s
| Mob Agua Médio | Água | 3 | 3/1 | 3 / 5s 
| Mob Fogo Médio | Fogo | 4 | 4/1 | 4 / 3s 
| Mob Grama Médio | Grama | 2 | 3/1 | 3 / 1s
| Mob Agua Forte | Água | 6 | 6/1 | 6 / 8s 
| Mob Fogo Forte | Fogo | 4 | 7/1 | 7 / 10s 
| Mob Grama Forte | Grama | 4 | 5/1 | 5 / 4s

### Spells
Spells mostram custo e cooldown, além da descrição do efeito. Não exibem nível, dano de criatura ou DEF.
- Os efeitos dos spells podem ser de dano, cura ou escudo, cada um com seu valor configurado. Ao completar o cooldown, o popup mostra espada e número para dano, ícone verde e número para cura, ou ícone amarelo e número para escudo.

### Recarga visual
Somente quando uma carta está no tabuleiro, uma linha branca sobe pela arte durante o cooldown; ao mesmo tempo, a imagem aumenta gradualmente o brilho e a saturação. Ao completar a recarga, a borda pisca em branco, o popup do efeito (dano, cura ou escudo) aparece brevemente acima da carta e a barra reinicia. O ciclo visual dura o valor de cooldown da carta, sem depender do tema ou elemento dela. Na mão, a arte permanece colorida e a animação não roda.

### Terrenos
Terrenos nao tem custo

### Construções
| Carta | Custo | Efeito |
|---|---|---|
| Muralha | 2 | Mobs adjacentes ganham +2 DEF
| Depósito | 2 | Jogador ganha +2 de mana por rolar de dados
| Altar | 4 | Jogador cura com base na metade do dano feito na fase de farm

## 9. Bot (IA)
Vamos criar por enquanto apenas um unico player adversario de IA, no futuro teremos personagens que os players podem selecionar e vamos montar um sistema como o de The Bazaar onde as batalhas nao sao online, voce luta com snapshoots da ultima build que um jogador aleatorio do seu nivel fez na sua ultima run

O bot jogador deve se preparar da seguinte maneira

1. Invocar a melhor criatura que consegue pagar.
2. Tenta invocar mobs e contruções
3. Faz o farm e compra na loja
4. Tiramos esse snapshot (em JSON)
5. fica pronto pra fila do gameplay loop do jogador real
6. fazemos 3 snapshoots para o jogador enfrentar no seu gameplay loop, ja que ganha o player derrotando 3 jogadores

## 10. Roadmap (sistemas planejados)
- **Pilha de terreno:** 1 a 3 camadas por casa. Cada camada dá +N/+N à criatura de mesmo elemento que estiver nela.
- **Mercado:** loja expandida, com reroll e raridades.
- **Efeitos completos:** Todos os mobs disparam projeteis de acordo com o elemento entao temos que ter as animações disso

## 11. Arte (estado atual)
- Personagens e mobs são, por enquanto, **sprites 2D** tirados de **um único PNG (spritesheet)** mas podemos fazer 3D.
- Esse PNG traz várias poses de animação de cada um, como parado, andando, atacando e morrendo.
- As poses ainda precisam ser **recortadas e montadas** em animações quadro a quadro, uma para cada estado.

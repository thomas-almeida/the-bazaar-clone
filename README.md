# Bazaar Clone

Jogo em **Next.js (App Router) + TypeScript + Tailwind CSS v4**, portado do
protótipo standalone `src/boargame/`. O protótipo original permanece no
repositório como referência histórica; a aplicação ativa está em `app/` e
`src/`.

## Rodar

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # build de produção
```

## Estrutura

| Caminho | Responsabilidade |
| --- | --- |
| `app/page.tsx` | Menu de entrada |
| `app/play/page.tsx` | Carrega o catálogo e inicia a run |
| `app/api/catalog/route.ts` | Catálogo ativo, contrato em `src/lib/types.ts` |
| `app/admin/page.tsx` | Editor protegido de cartas e patches |
| `supabase/migrations/` | Schema e catálogo inicial do editor |
| `app/globals.css` | Tailwind v4, tabuleiro e estilos |
| `src/lib/store.ts` | Máquina de estados e gameplay loop |
| `src/lib/catalog.ts` | Catálogo local, configuração e builds adversários |
| `src/hooks/useCombatEngine.ts` | Combate, haste, névoa e animações |
| `src/components/` | Tabuleiro, cartas, mão, HUD e modais |
| `src/boargame/` | **Protótipo standalone de referência — preservar** |

Para regras, valores atuais, fases, editor e itens planejados, consulte o
[guia atualizado do protótipo e do estado atual](./BOARGAME-PROTOTYPE-GUIDE.md).

## Configuração de teste atual

O modo de teste usa mana infinita, preço de bazar 1, vida máxima 50 e quatro
slots no tabuleiro. A configuração declara mão máxima de sete, mas a
inicialização atual expande esse limite para 999. O catálogo de produção pode
ser servido pelo patch publicado no Supabase; uma falha nesse endpoint é
apresentada como erro, não é substituída silenciosamente pelo catálogo local.

## Editor de balanceamento

O painel `/admin` permite editar cartas existentes, salvar rascunhos e publicar
patches de forma explícita. Configure `.env.local` a partir de
[`.env.example`](./.env.example) e execute a migration no SQL Editor do
Supabase. Credenciais privilegiadas devem permanecer no servidor. O upload
local de arte é exclusivo de desenvolvimento; os detalhes completos estão no
guia.

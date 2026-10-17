# Identidade visual do PetVision

Este guia preserva a linguagem visual atual do PetVision. Use-o ao criar ou
alterar telas do dashboard, inclusive funcionalidades futuras do AI Engine.
Ele complementa os componentes compartilhados; a fonte técnica dos valores é
[`packages/ui/src/styles/globals.css`](../packages/ui/src/styles/globals.css).

## Direção do produto

O PetVision é uma ferramenta doméstica de monitoramento: deve parecer
**confiável, calma, precisa e acolhedora**. A interface prioriza a leitura do
estado do pet e a tomada de ação, sem transformar o fluxo cotidiano em um
painel técnico de visão computacional.

- Use uma hierarquia tranquila: título objetivo, contexto curto e uma ação
  principal por área.
- Dê protagonismo ao vídeo, à presença do pet e aos alertas úteis.
- Mostre detalhes técnicos somente quando ajudam a verificar o monitoramento
  (por exemplo, FPS, ciclo e estado do motor).
- Prefira texto claro em português: “Monitoramento pausado” é melhor que
  “stream indisponível”.

## Fundamentos visuais

### Cor

O produto usa superfícies neutras e quentes no tema claro, azul-esverdeado
profundo no escuro e aqua/turquesa como sinal de ação e monitoramento. Nunca
copie valores hexadecimais de uma tela: use os tokens semânticos abaixo.

| Necessidade | Token recomendado |
| --- | --- |
| Fundo da aplicação | `bg-background` |
| Superfície de card, formulário ou menu | `bg-card`, `text-card-foreground` |
| Superfície interna ou neutra | `bg-surface-raised`, `bg-muted` |
| Texto secundário e ajuda | `text-muted-foreground` |
| Ação principal e item ativo | `bg-primary`, `text-primary-foreground` |
| Hover e seleção suave | `bg-accent`, `text-accent-foreground` |
| Linha divisória e contorno | `border-border` |
| Sucesso, atenção, informação e erro | `success`, `warning`, `info`, `destructive` |
| Dados em gráficos | `chart-1` a `chart-5` |

Os tokens têm valores próprios para claro e escuro em `:root` e `.dark`. Ao
usar tokens, a mesma tela se adapta aos dois temas sem classes condicionais.

**Não use `primary` para todo significado positivo.** `primary` representa
ação e foco de marca; presença confirmada usa `success`, alertas usam
`warning` ou `destructive` e informação neutra usa `info`.

### Tipografia e forma

- Fonte padrão: Geist Sans; valores técnicos usam Geist Mono.
- Títulos: peso `semibold`, espaçamento levemente fechado (`tracking-tight` ou
  `tracking-[-0.035em]`) e texto direto.
- Rótulos de seção/metadados: 10–11 px, caixa alta, `font-semibold` e tracking
  amplo. Não use esse estilo para parágrafos.
- Texto de apoio: normalmente 12–14 px em `text-muted-foreground`.
- Campos e botões usam bordas arredondadas `rounded-xl`; cards de área usam
  `rounded-2xl` ou `rounded-[28px]` quando forem superfícies principais.
- Sombras são discretas e reforçam agrupamento, não decoração.

### Tema

Há três preferências: **Claro**, **Escuro** e **Sistema**. A seleção é salva no
`localStorage` com a chave `theme` e aplicada na classe do elemento `html`.

- O `ThemeProvider` em `apps/web/src/components/theme-provider.tsx` cuida das
  mudanças durante o uso.
- O script em `apps/web/src/app/layout.tsx` aplica o tema salvo antes da
  primeira pintura e evita o flash claro ao recarregar uma página escura.
- Não mova esse script para um componente cliente e não crie tags `<script>`
  dentro de componentes React clientes: isso quebra a execução/hidratação no
  Next.js.
- Todo elemento novo deve funcionar nos dois temas usando tokens. Verifique
  também texto, ícones, inputs, popovers e bordas; não só o fundo da página.

## Estrutura e navegação

O dashboard usa uma barra lateral fixa, com áreas de produto em **Central** e
preferências em **Conta**. A navegação ativa recebe uma superfície aqua suave,
ícone destacado e indicador visual; itens inativos são neutros.

- Desktop: a barra pode ser recolhida sem ocultar os ícones ou perder labels
  acessíveis.
- Mobile: a barra vira um painel sobreposto, fecha ao navegar ou com `Esc`.
- A área de conteúdo usa `pv-app-canvas`, que fornece o fundo discreto da
  aplicação. Não recrie gradientes por página.
- Evite cards explicativos apenas para preencher espaço. Informações devem
  estar próximas à ação, ao status ou ao dado que explicam.

## Componentes e estados

Antes de criar um controle novo, procure em `packages/ui/src/components`.

```tsx
import { Button } from "@tccpet/ui/components/button";
import { Input } from "@tccpet/ui/components/input";
```

- `Button`: use `default` para a ação primária, `outline` para ação secundária,
  `ghost` para ações de baixa ênfase e `destructive` para exclusão.
- `Input`: mantenha rótulo visível, placeholder que exemplifique o conteúdo e
  feedback de erro associado ao campo.
- Feedback transitório: use o `Toaster` já configurado, sem substituir uma
  confirmação importante persistente na própria tela.
- Estados vazios devem orientar uma única próxima ação, não duplicar o mesmo
  botão em vários pontos.

### Monitoramento e IA

O vídeo é uma superfície operacional deliberadamente escura, inclusive no tema
claro, para preservar contraste do feed e das caixas de detecção. Ao criar uma
tela de IA:

- use `StreamDetectionOverlay` para caixas, rótulos e estados de identificação;
  não desenhe outro padrão de bounding box na página;
- diferencie visualmente **identificado**, **possível/em confirmação** e
  **não identificado** com texto e cor — nunca apenas cor;
- agrupe métricas de desempenho como informação auxiliar e monoespaçada;
- mantenha o controle de iniciar/pausar explícito. A Visão geral exibe o estado
  do AI Engine, mas não deve iniciar a câmera ao ser aberta;
- mantenha parâmetros internos de modelo, embeddings e limiares fora do fluxo
  principal do tutor, salvo em áreas técnicas claramente nomeadas.

## Acessibilidade obrigatória

- Todo controle interativo deve ter rótulo legível ou `aria-label`.
- Preserve `:focus-visible`; não remova o anel de foco para “limpar” a tela.
- Use contraste dos tokens e teste claro/escuro. Não use cinza claro para texto
  essencial.
- Respeite `prefers-reduced-motion`; animações não podem comunicar o único
  estado disponível.
- Ícones decorativos devem usar `aria-hidden`; ícones que executam ação devem
  ter descrição acessível.

## Onde alterar

| Alteração | Local |
| --- | --- |
| Tokens, temas, foco e canvas | `packages/ui/src/styles/globals.css` |
| Botões, inputs e primitives compartilhadas | `packages/ui/src/components/` |
| Tema e persistência da preferência | `apps/web/src/components/theme-provider.tsx` |
| Seletor de tema | `apps/web/src/components/mode-toggle.tsx` |
| Estrutura e navegação do dashboard | `apps/web/src/app/dashboard/dashboard-shell.tsx` |
| Overlay de detecções | `apps/web/src/components/stream-detection-overlay.tsx` |

## Checklist para uma tela nova

Antes de considerar uma tela pronta, confirme:

- [ ] Usa tokens semânticos, não cores copiadas de outra tela.
- [ ] Funciona e tem contraste no tema claro e no escuro.
- [ ] Reutiliza componentes de `packages/ui` quando existir equivalente.
- [ ] Tem uma ação principal clara e estados vazio, carregando e erro coerentes.
- [ ] É navegável por teclado, apresenta foco visível e labels acessíveis.
- [ ] Mantém informações de IA técnicas como apoio, sem esconder o estado do
      monitoramento.
- [ ] Foi validada com `npm run check-types --workspace web` e
      `npm run build --workspace web`.

## Regra de evolução

Quando uma decisão visual se repetir em duas ou mais telas, transforme-a em um
token, componente compartilhado ou regra deste documento. Isso evita que novas
funções — especialmente as de IA — criem uma segunda identidade visual dentro
do mesmo produto.

# PetVision AI

> Protótipo acadêmico para monitoramento visual local de cães, com detecção,
> rastreamento, identificação por referências visuais e registro de eventos.

O **PetVision AI** é o produto desenvolvido no Trabalho de Conclusão de Curso
que investiga a aplicação de visão computacional no acompanhamento de cães por
câmeras. A aplicação combina uma interface web, um motor local de inteligência
artificial e um banco de dados com busca vetorial para transformar imagens em
detecções, trajetórias, possíveis identificações e evidências auditáveis.

O projeto é voltado a fins educacionais e experimentais. Ele não é um sistema
de segurança, nem oferece garantia de identificação correta em todas as
condições de iluminação, distância, oclusão ou qualidade de câmera.

## Visão geral

| Camada | Tecnologia | Responsabilidade |
| --- | --- | --- |
| Dashboard | Next.js, React, Tailwind CSS e tRPC | Cadastro, monitoramento, configurações, relatórios e exportações |
| AI Engine | Python, FastAPI, OpenCV, Ultralytics e OpenCLIP | Captura, detecção, tracking, embeddings e transmissão de eventos |
| Dados | PostgreSQL, pgvector, Drizzle ORM e Better Auth | Autenticação, pets, câmeras, embeddings, sessões, eventos e preferências |

### Capacidades implementadas

- Cadastro de perfis de cães e fotos de referência.
- Geração de embeddings visuais com OpenCLIP e armazenamento no PostgreSQL
  com pgvector.
- Fontes de vídeo por webcam local, captura de tela, URL HTTP e RTSP.
- Detecção de cães com YOLO e rastreamento temporal com ByteTrack.
- Identificação individual baseada em similaridade, margem de decisão e
  confirmação temporal.
- Monitoramento de presença/ausência, cooldown de alertas e notificações do
  navegador quando autorizadas.
- Dashboard de sessões, eventos, desempenho e exportações CSV, JSON, SVG e
  PNG.
- Curvas ROC e Precisão–Revocação para avaliar a separação interna dos
  embeddings cadastrados.

> O escopo funcional e experimental do PetVision AI é **cães**. As métricas
> dependem das referências cadastradas e devem ser interpretadas de acordo com
> o protocolo de validação do projeto.

## Arquitetura

```text
Fonte de vídeo
   │ webcam · tela · HTTP · RTSP
   ▼
AI Engine (FastAPI)
   │ YOLO → ByteTrack → recorte → OpenCLIP
   │                           │
   │                       embeddings
   ▼                           ▼
Webhook autenticado ────── Next.js / tRPC ────── PostgreSQL + pgvector
                                  │
                                  ▼
                         Dashboard e Relatórios
```

O vídeo e a inferência são processados localmente pelo AI Engine. O dashboard
recebe eventos autenticados e consulta dados apenas do usuário conectado.

## Estrutura do repositório

```text
pet-vision-ai/
├── apps/
│   ├── web/                 # Next.js: dashboard, API, autenticação e uploads locais
│   └── ai-engine/           # FastAPI: vídeo, IA, tracking e webhooks
├── packages/
│   ├── api/                 # tRPC, regras de negócio e avaliação de identificação
│   ├── auth/                # Better Auth
│   ├── db/                  # Drizzle, PostgreSQL, pgvector e Docker
│   └── ui/                  # Componentes e tokens visuais compartilhados
├── scripts/                 # Avaliações e testes de exportação
└── docs/                    # Protocolo experimental e documentação técnica
```

## Requisitos

Para reproduzir o ambiente local, instale:

- Node.js 22 ou superior e npm;
- Python 3.11 ou superior, com o comando `py` disponível no Windows;
- Docker Desktop em execução;
- uma câmera local, tela compartilhável ou URL HTTP/RTSP para monitoramento;
- opcionalmente, GPU NVIDIA com ambiente PyTorch/CUDA compatível.

O sistema também executa em CPU. Nesse caso, a taxa de análise e a latência
dependem do hardware, da resolução e da fonte de vídeo. Na primeira execução,
os pesos dos modelos podem ser baixados e o início pode demorar mais.

## Início rápido

Todos os comandos devem ser executados na raiz do repositório. Os exemplos
abaixo usam PowerShell no Windows.

### 1. Instale as dependências e prepare os ambientes locais

```powershell
npm install
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item apps/ai-engine/.env.example apps/ai-engine/.env
```

Crie um segredo para autenticação:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Em `apps/web/.env`, substitua o valor de `BETTER_AUTH_SECRET`. Depois, defina
um mesmo valor não vazio de `AI_WEBHOOK_SECRET` em `apps/web/.env` e
`apps/ai-engine/.env`. Esse segredo autentica os eventos enviados pelo motor
local à aplicação web.

Não versione arquivos `.env`, senhas, URLs RTSP com credenciais, tokens ou
backups do banco.

### 2. Inicie e atualize o banco de dados

```powershell
npm run db:start
npm run db:push
```

O banco local é PostgreSQL com pgvector e fica disponível, por padrão, em
`localhost:5433`. Para confirmar que a extensão vetorial foi carregada:

```powershell
docker compose -f packages/db/docker-compose.yml exec postgres psql -U postgres -d tccpet -c "\dx vector"
```

Execute `npm run db:push` depois de receber alterações de esquema por
`git pull`. O comando atualiza um banco existente para o estado declarado pelo
projeto; ele não substitui o cuidado com dados locais importantes.

### 3. Prepare o AI Engine

```powershell
py -m venv apps/ai-engine/.venv
.\apps\ai-engine\.venv\Scripts\python.exe -m pip install -r .\apps\ai-engine\requirements.txt
```

### 4. Inicie a aplicação

```powershell
npm run dev
```

Abra [http://localhost:3001](http://localhost:3001). O comando inicia:

- **Next.js:** `http://localhost:3001`;
- **FastAPI / AI Engine:** `http://127.0.0.1:8000`.

Para confirmar o estado do motor, acesse
[http://127.0.0.1:8000/status](http://127.0.0.1:8000/status). Para iniciar
somente uma camada, use `npm run dev:web` ou `npm run dev:ai`.

## Primeiro fluxo de uso

1. Crie uma conta ou entre no dashboard.
2. Em **Animais**, cadastre um cão e uma foto inicial bem iluminada.
3. Adicione referências do mesmo cão sob ângulos, distâncias e iluminações
   diferentes.
4. Em **Câmeras**, escolha a fonte, salve-a e defina-a como padrão.
5. Inicie o monitoramento explicitamente na página de Câmeras.
6. Acompanhe as detecções, identificações, presença e desempenho no dashboard.
7. Em **Relatórios**, filtre as sessões e exporte eventos, métricas e gráficos.

A fonte escolhida na tela de Câmeras só é usada pelo monitoramento após ser
salva. A primeira câmera salva torna-se padrão; se ela for removida, a câmera
salva mais recente assume essa função.

## Avaliação de identificação e evidências acadêmicas

O painel de **Relatórios** gera sob demanda uma avaliação interna dos
embeddings do usuário autenticado. Ele compara pares de fotos do mesmo cão e
de cães diferentes, apresentando:

- curva ROC e área sob a curva (AUC);
- curva Precisão–Revocação e Average Precision (AP);
- pares positivos e negativos analisados;
- limiar de Youden como referência de equilíbrio;
- exportações em SVG, PNG e JSON.

Essa avaliação é útil para verificar a separação da base de referência e
calibrar decisões de similaridade. Ela **não substitui** a validação final em
imagens de consulta independentes — imagens usadas para teste não devem ter
sido cadastradas como referência.

Consulte:

- [Protocolo de validação experimental](docs/VALIDACAO_EXPERIMENTAL.md)
- [Avaliação e exportação da identificação](docs/AVALIACAO_DE_IDENTIFICACAO.md)

## Testes e verificações

```powershell
# Tipos TypeScript do monorepo
npm run check-types

# Testes automatizados do AI Engine
npm run test:ai

# Métricas, curvas e isolamento da avaliação de identificação
npm run test:evaluation

# Exportações de relatórios, gráficos de linha do tempo e eventos
npm run test:reports
npm run test:report-chart
npm run test:report-events

# Diagnóstico leave-one-out das referências atualmente cadastradas
npm run evaluate:identification
```

`evaluate:identification` não treina um modelo novo. Ele é um diagnóstico
leave-one-out das referências existentes no banco e deve ser tratado como linha
de base interna. Resultados experimentais devem registrar commit, configuração,
hardware, dados utilizados e arquivos exportados.

## Configurações relevantes

Os arquivos `.env.example` descrevem os valores de partida. Os principais
parâmetros experimentais estão em `apps/ai-engine/.env`:

| Variável | Propósito |
| --- | --- |
| `CAMERA_SOURCE` | Webcam, URL HTTP ou RTSP usada inicialmente pelo motor |
| `STREAM_TARGET_FPS` | Taxa alvo da inferência e tracking |
| `STREAM_PREVIEW_FPS` | Taxa máxima de exibição do preview |
| `DETECTION_IMAGE_SIZE` | Tamanho de entrada usado na detecção |
| `DETECTION_CONFIDENCE_THRESHOLD` | Confiança mínima das detecções |
| `DETECTION_DUPLICATE_CONTAINMENT_THRESHOLD` | Cobertura mínima para remover caixas aninhadas do mesmo cão |
| `IDENTIFICATION_INTERVAL_SECONDS` | Intervalo entre tentativas de identificação |
| `DEFAULT_ABSENCE_ALERT_SECONDS` | Tolerância antes do alerta de ausência |
| `DEFAULT_NOTIFICATION_COOLDOWN_SECONDS` | Intervalo mínimo entre notificações repetidas |

No frontend, `PET_MATCH_MIN_SIMILARITY` e `PET_MATCH_MIN_MARGIN` definem os
critérios iniciais de confirmação da identificação. Não altere parâmetros no
meio de uma rodada experimental sem registrar a alteração.

## Privacidade, dados e licença

- Use somente fotos e vídeos próprios ou autorizados.
- Não publique uploads de usuários, dados de login, arquivos `.env`, tokens,
  senhas ou URLs de câmera com credenciais.
- Prefira nomes fictícios ou identificadores anonimizados em evidências
  públicas, quando necessário.
- O processamento de vídeo ocorre localmente no AI Engine desta instalação.

O repositório é distribuído sob a licença
[GNU AGPL-3.0](LICENSE). Ela se aplica ao projeto e é particularmente relevante
porque o AI Engine utiliza Ultralytics YOLO sob AGPL-3.0. Ao redistribuir ou
disponibilizar uma versão modificada como serviço de rede, preserve as
obrigações da licença e disponibilize o código-fonte correspondente.

Consulte [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) antes de redistribuir
o sistema, trocar modelos ou pesos, ou publicar uma nova versão.

## Documentação complementar

| Documento | Conteúdo |
| --- | --- |
| [PRODUCT.md](PRODUCT.md) | Escopo e decisões do produto |
| [Identidade visual](docs/IDENTIDADE_VISUAL.md) | Tokens, componentes e padrões da interface |
| [Validação experimental](docs/VALIDACAO_EXPERIMENTAL.md) | Ambiente, protocolo e evidências do TCC |
| [Avaliação de identificação](docs/AVALIACAO_DE_IDENTIFICACAO.md) | Curvas, métricas e exportações |
| [Avisos de terceiros](THIRD_PARTY_NOTICES.md) | Componentes, licenças e cuidados de distribuição |

## Solução de problemas

| Situação | Verificação recomendada |
| --- | --- |
| `turbo is not recognized` | Execute `npm install` na raiz após clonar o repositório. |
| `url: ''` no `db:push` | Confirme `apps/web/.env`, `DATABASE_URL` e a execução na raiz. |
| AI Engine não inicia | Verifique `apps/ai-engine/.venv/Scripts/python.exe`; recrie o ambiente da etapa 3 se necessário. |
| Painel informa que o motor não respondeu | Mantenha `npm run dev` aberto e verifique `/status` na porta 8000. |
| Feed preto ou em espera | Salve uma câmera e marque-a como padrão antes de iniciar o monitoramento. |
| Porta 3001 em uso | Encerre a instância anterior do Next.js ou libere a porta antes de executar `npm run dev`. |

## Contribuição e reprodução

Contribuições devem preservar o escopo acadêmico, a privacidade dos dados e a
reprodutibilidade dos experimentos. Antes de abrir uma alteração:

1. não inclua arquivos `.env`, uploads, pesos baixados ou evidências pessoais;
2. execute os testes relacionados à alteração;
3. registre mudanças de parâmetros, modelo ou dependências nos documentos de
   validação e avisos de terceiros;
4. mantenha os resultados experimentais separados por rodada, com commit e
   contexto de execução identificados.

---

PetVision AI — protótipo acadêmico de visão computacional para monitoramento
local de cães.

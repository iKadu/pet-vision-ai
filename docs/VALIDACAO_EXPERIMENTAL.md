# Validação experimental — PetVision AI

Este é o registro vivo da validação experimental do TCC. Ele separa o que foi
**confirmado no ambiente** do que ainda precisa ser medido em imagens e vídeos.
Não preencha métricas estimadas: cada rodada deve apontar para seus logs, CSVs,
anotações e capturas correspondentes.

## 1. Registro de ambiente e configuração

**Data da auditoria:** 16 de outubro de 2026 (America/Sao_Paulo)<br />
**Repositório:** `petVisionAiTcc/pet-vision-ai`<br />
**Branch:** `main`<br />
**Commit de referência:** `88fc72e05a704bc04da042afd2f9495476e677b6`<br />
**Árvore de trabalho na auditoria:** limpa

Os resultados de uma rodada só podem ser comparados quando o commit, os
parâmetros e o hardware abaixo forem registrados novamente ou declarados como
inalterados.

### 1.1 Hardware e sistema operacional

| Item | Valor observado |
| --- | --- |
| Sistema operacional | Windows 11 Pro 64-bit, versão 10.0.26300 (build 26300) |
| CPU | Intel Core i5-12450H, 8 núcleos / 12 processadores lógicos |
| Memória RAM | 15,8 GiB |
| GPU instalada | NVIDIA GeForce RTX 3050 6GB Laptop GPU |
| Memória da GPU | 6144 MiB |
| Driver NVIDIA | 617.42 |
| Docker Desktop | cliente 29.6.1 / servidor 29.6.1 |

> **Observação importante:** embora exista uma GPU NVIDIA, o PyTorch instalado
> nesta auditoria é `2.14.0+cpu`. `torch.cuda.is_available()` retornou `False`.
> Logo, a inferência desta configuração é executada em **CPU**. Não atribua
> métricas desta rodada à GPU e não compare diretamente com futuras execuções
> CUDA sem separar as tabelas.

### 1.2 Dependências efetivamente instaladas

| Camada | Versão |
| --- | --- |
| Node.js | v24.18.0 |
| npm | 11.16.0 |
| Python (venv do AI Engine) | 3.14.6 |
| Next.js | 16.3.1 |
| React / React DOM | 19.2.8 |
| TypeScript | 6.0.3 |
| Tailwind CSS | 4.3.3 |
| tRPC Server | 11.18.0 |
| TanStack React Query | 5.101.4 |
| FastAPI | 0.141.1 |
| Uvicorn | 0.54.0 |
| OpenCV | 5.0.0 |
| Ultralytics | 8.4.163 |
| PyTorch | 2.14.0+cpu |
| OpenCLIP | 3.3.0 |
| NumPy | 2.5.3 |
| Pydantic | 2.13.5 |
| Requests | 2.34.2 |

As versões declaradas em `requirements.txt` são limites mínimos. Esta tabela é
a referência para reproduzir a execução auditada, pois registra as versões
realmente presentes no ambiente virtual.

### 1.3 Serviços locais

| Serviço | Configuração esperada | Estado na auditoria |
| --- | --- | --- |
| Frontend Next.js | `http://localhost:3001` | não iniciado durante a coleta |
| AI Engine FastAPI | `http://127.0.0.1:8000` | não iniciado durante a coleta |
| PostgreSQL + pgvector | Docker `pgvector/pgvector:pg17`, porta local `5433` | contêiner parado; versão da instância e extensão não verificadas |

Antes de qualquer rodada que use o banco, execute `npm run db:start` e registre
o retorno de:

```powershell
docker compose -f packages/db/docker-compose.yml exec postgres psql -U postgres -d tccpet -c "\dx vector"
```

Isso comprova que a extensão `pgvector` está ativa na instância usada para os
embeddings. Não usar resultados antigos caso o banco, as referências ou as
configurações tenham mudado.

## 2. Configuração do AI Engine

### 2.1 Situação dos arquivos de ambiente

Na auditoria, `apps/ai-engine/.env` **não existia**. Portanto, o processo
Python recebe os valores padrão definidos no código, salvo variáveis inseridas
explicitamente pelo terminal. O único parâmetro experimental encontrado em
`apps/web/.env` foi `STREAM_PREVIEW_FPS=30`, mas esse arquivo não substitui o
`.env` do processo Python de forma garantida.

Para uma rodada reproduzível, antes de iniciar o AI Engine:

```powershell
Copy-Item apps/ai-engine/.env.example apps/ai-engine/.env
```

Preencha os parâmetros da rodada nesse arquivo e registre-os na tabela abaixo.
Não versione `.env`, URLs com credenciais, `DATABASE_URL`,
`AI_WEBHOOK_SECRET` ou `BETTER_AUTH_SECRET`.

### 2.2 Valores efetivos se o motor for iniciado sem `.env`

| Parâmetro | Valor efetivo padrão | Origem |
| --- | --- | --- |
| Fonte inicial | webcam `0` | `main.py` |
| FPS alvo da IA e tracking | 5 FPS | `core/stream.py` |
| FPS máximo do preview | 15 FPS | `core/stream.py` |
| Tamanho de entrada da detecção | 768 px | `core/detection_settings.py` |
| Limiar de confiança YOLO | 0,18 | `core/detection_settings.py` |
| Intervalo entre tentativas de identificação | 0,5 s | `main.py` |
| Padding do recorte para embedding | 0,08 | `main.py` |
| Tamanho mínimo do recorte | 96 px | `main.py` |
| IoU para supressão de detecções duplicadas | 0,55 | `main.py` |
| Máximo de pontos da trajetória | 120 | `main.py` |
| Inatividade máxima de trajetória | 30 s | `main.py` |
| Janela de atividade | 10 s | `main.py` |
| Limite de deslocamento para atividade | 0,08 | `main.py` |
| Intervalo de webhook de tracking | 1 s | `main.py` |
| Alerta de ausência | 30 s | `main.py` |
| Cooldown de notificação | 300 s | `main.py` |

Esses são os valores de partida; não são necessariamente os valores de cada
experimento. Cada alteração deve ser registrada com data, motivo e commit.

### 2.3 Modelos e decisão de identificação

| Componente | Configuração |
| --- | --- |
| Detector | Ultralytics YOLO com `yolo11n.pt` |
| SHA-256 do peso local | `0EBBC80D4A7680D14987A577CD21342B65ECFD94632BD9A8DA63AE6417644EE1` |
| Classes rastreadas | COCO 15 (`cat`) e 16 (`dog`) |
| Tracker | ByteTrack, `apps/ai-engine/core/bytetrack.yaml` |
| Buffer ByteTrack | 60 frames |
| Encoder visual | OpenCLIP `ViT-B-32` |
| Pesos OpenCLIP | `laion2b_s34b_b79k` |
| Dimensão dos embeddings | 512, normalizados por L2 |
| Similaridade mínima | 0,75 (default do backend web) |
| Margem mínima | 0,05 (default do backend web) |

O sistema classifica a melhor correspondência como **confirmada** quando atende
à similaridade e à margem; como **possível** quando a similaridade é suficiente
mas a margem não é segura; ou como **rejeitada** quando não atende ao limiar de
similaridade. Esses valores devem ser mantidos fixos durante uma rodada de
comparação.

> Com 5 FPS alvo, o `track_buffer` de 60 frames corresponde teoricamente a
> cerca de 12 segundos de tolerância entre atualizações do tracker. O comentário
> do arquivo ByteTrack menciona 2 FPS/30 segundos; ele não representa a
> configuração padrão atual e deve ser tratado como observação histórica, não
> como parâmetro experimental.

## 3. Comandos da rodada

Execute os comandos a partir da raiz do repositório e guarde a saída bruta em
um diretório local de evidências, fora do Git.

```powershell
git rev-parse HEAD
git status --short
npm run db:start
npm run test:ai
npm run test:evaluation
npm run evaluate:identification
npm run dev
```

`evaluate:identification` é uma avaliação leave-one-out das referências do
banco. Ela é útil como diagnóstico interno, mas não substitui a futura avaliação
com imagens de consulta independentes.

Para gerar figuras e um resumo reprocessável da rodada, informe uma pasta local
de evidências. A pasta `artifacts/` é ignorada pelo Git:

```powershell
npm run evaluate:identification -- --output artifacts/evaluation/rodada-YYYY-MM-DD
```

O comando produz `curva-roc-identificacao.svg`,
`curva-precisao-revocacao-identificacao.svg` e
`resumo-avaliacao-identificacao.json`. As curvas avaliam a separação binária
entre pares do mesmo pet e de pets diferentes; elas calibram a similaridade e
não substituem a avaliação da margem de decisão nem a validação independente.

## 4. Registro obrigatório de cada experimento

Antes de começar uma nova execução, anote:

- identificador da rodada e data/hora;
- commit completo e estado limpo do Git;
- fonte, resolução e duração do vídeo;
- parâmetros da tabela 2.2, inclusive qualquer sobrescrita no `.env`;
- modelo, hash do peso e dispositivo efetivamente usado (`CPU` ou `CUDA`);
- número de referências e de consultas por pet;
- responsáveis pela gravação e anotação;
- autorização para uso das imagens e ausência de pessoas identificáveis.

Ao final, salve os logs, CSVs, JSONs de anotação, telas do dashboard e métricas
em uma pasta local versionada por data. No Git devem permanecer somente os
scripts, modelos vazios de planilha e resultados anonimizados.

## 5. Próximas evidências pendentes

| Evidência | Estado atual | Próximo artefato necessário |
| --- | --- | --- |
| Identificação independente | pendente | imagens de consulta separadas e avaliador próprio |
| Detecção com IoU | pendente | frames/vídeos anotados e script de métricas |
| Tracking | pendente | anotações de identidade e continuidade de `track_id` |
| Presença e ausência | pendente | roteiro de entrada/saída e log de tempos |
| Desempenho | pendente | amostragem de FPS, latência, CPU, RAM e GPU |
| Integração ponta a ponta | pendente | roteiro, logs do webhook e capturas do dashboard |

## 6. Rodada-base executada

**Data:** 16 de outubro de 2026<br />
**Commit avaliado:** `88fc72e05a704bc04da042afd2f9495476e677b6`<br />
**Dispositivo efetivo de inferência:** CPU

### 6.1 Pré-condições confirmadas

- `apps/ai-engine/.env` foi criado localmente a partir da configuração-base da
  seção 2.2; o arquivo permanece ignorado pelo Git.
- Um novo `AI_WEBHOOK_SECRET` foi configurado localmente e confirmado como
  idêntico no frontend e no AI Engine. O valor não foi registrado neste
  documento.
- PostgreSQL iniciado com sucesso; versão observada: PostgreSQL 17.11.
- Extensão `pgvector` ativa: `vector=0.8.6`.
- O banco possui 10 tabelas públicas.
- `db:push` executado sem alterações de schema. Nesta máquina, o Turbo exigiu
  `TURBO_UI=true` para a execução interativa do comando.

### 6.2 Testes automatizados

| Comando | Resultado observado |
| --- | --- |
| `npm run test:ai` | 43 testes aprovados em 5,55 s |
| `npm run test:evaluation` | 2 testes aprovados em 159,8646 ms |

Os testes Python cobrem atividade, detecções, rotas e serviço de embeddings,
identificação, presença, stream e tracking. Os testes TypeScript confirmam as
regras de confirmação, ambiguidade, rejeição e consolidação de métricas.

### 6.3 Avaliação leave-one-out existente

Comando executado: `npm run evaluate:identification`.

| Métrica | Resultado |
| --- | --- |
| Amostras válidas | 16 |
| Consultas avaliáveis | 16 |
| Top-1 correto | 93,8% |
| Confirmações corretas | 14/16 |
| Identificações incorretas confirmadas | 0 |
| Casos ambíguos | 1 |
| Consultas rejeitadas | 1 |
| Similaridade positiva mediana | 0,847 |
| Menor similaridade positiva | 0,729 |
| Maior similaridade negativa | 0,772 |
| Margem mediana nos acertos | 0,216 |
| Menor margem nos acertos | 0,042 |
| Maior margem em erro Top-1 | 0,008 |
| Margem inicial sugerida pelo script | 0,025 |

Matriz de confusão observada:

- Gui → Gui: 3; Mala: 1.
- Mala → Mala: 4.
- Vini → Vini: 4.
- Zoe → Zoe: 4.

> Esta é uma **linha de base interna**, pois usa leave-one-out nas próprias
> referências cadastradas. Ela demonstra o comportamento atual do pipeline e
> revela uma confusão entre Gui e Mala, mas não deve ser apresentada como a
> acurácia final em imagens independentes.

### 6.4 Smoke test de integração local

O comando `npm run dev` foi iniciado temporariamente e respondeu como esperado:

- FastAPI: `GET /status` retornou `online`, stream pausado e amostragem de
  `5.0 FPS`.
- Next.js: `GET /login` retornou HTTP 200.
- Os processos foram encerrados ao fim da verificação; as portas 3001 e 8000
  foram confirmadas como livres.

Esse smoke test confirma disponibilidade local, não substitui o experimento
ponta a ponta com fonte de vídeo, detecções, webhooks, banco e dashboard.

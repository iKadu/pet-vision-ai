# Avisos de componentes de terceiros

Este documento registra os principais componentes externos utilizados pelo
PetVision AI e deve acompanhar qualquer cópia distribuída do projeto. Ele não
substitui os textos completos de licença presentes nos pacotes instalados.

## Licença do projeto

O repositório é distribuído sob a **GNU Affero General Public License, versão 3
(AGPL-3.0)**. O texto integral está no arquivo
[`LICENSE`](LICENSE).

## Motor de detecção

| Componente | Uso no PetVision | Licença / condição |
| --- | --- | --- |
| [Ultralytics YOLO](https://github.com/ultralytics/ultralytics) e `yolo11n.pt` | Detecção e tracking de cães e gatos no AI Engine | AGPL-3.0, salvo aquisição de licença Enterprise. Ao usar o projeto sob a licença gratuita, o código-fonte correspondente deve permanecer disponível sob AGPL-3.0. |
| [OpenCLIP](https://github.com/mlfoundations/open_clip) | Geração dos embeddings visuais para comparação entre pets | MIT. Preservar o aviso de copyright e a licença ao redistribuir. |
| `ViT-B-32` com pesos `laion2b_s34b_b79k` | Pesos padrão carregados pelo OpenCLIP | Os pesos são um artefato distinto da biblioteca. Registrar o identificador e consultar a model card e os termos do provedor antes de trocar ou redistribuir os pesos. |

O sistema não treina nem publica um novo modelo. Ele usa os pesos acima para
gerar embeddings das imagens de referência autorizadas pelo usuário.

## Aplicação e banco

| Componente | Uso no PetVision |
| --- | --- |
| [Next.js](https://github.com/vercel/next.js), [React](https://github.com/facebook/react) e TypeScript | Aplicação web. |
| [FastAPI](https://github.com/fastapi/fastapi), Uvicorn, NumPy e OpenCV | API e processamento local de vídeo. |
| [tRPC](https://github.com/trpc/trpc), [Drizzle](https://github.com/drizzle-team/drizzle-orm), PostgreSQL e [pgvector](https://github.com/pgvector/pgvector) | API, persistência e busca vetorial. O pgvector usa a licença PostgreSQL. |
| [Better Auth](https://github.com/better-auth/better-auth) | Autenticação local. |
| [Lucide](https://github.com/lucide-icons/lucide) | Ícones da interface; licença ISC. |
| Tailwind CSS, TanStack Query/Form, Zod, Sonner e demais dependências declaradas nos manifestos `package.json` | Interface e infraestrutura da aplicação. |

As versões efetivamente instaladas de dependências JavaScript são registradas em
`package-lock.json`. As dependências Python declaradas estão em
`apps/ai-engine/requirements.txt`. Ao criar um pacote distribuível, preserve os
arquivos `LICENSE` que acompanham os pacotes e atualize esta lista se houver
troca de biblioteca, modelo ou peso.

## Dados, privacidade e demonstração

- Use somente fotos e vídeos próprios ou com autorização explícita para testes,
  vídeos de apresentação e banca.
- Não envie ao Git os uploads de usuários em `apps/web/public/uploads/`; esse
  diretório é ignorado intencionalmente.
- Não envie arquivos `.env`, tokens, senhas, URLs com credenciais ou backups do
  banco de dados.
- Ao apresentar resultados de identificação, prefira IDs ou nomes fictícios se
  as imagens não forem dos próprios autores.

## Limitação de uso

O PetVision AI é um protótipo acadêmico de monitoramento local. As métricas de
identificação dependem do conjunto de imagens de referência e não constituem
garantia de reconhecimento em qualquer ambiente, distância ou iluminação.

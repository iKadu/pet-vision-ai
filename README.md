# tccpet

This project was created with [Better-T-Stack](https://github.com/AmanVarshney01/create-better-t-stack), a modern TypeScript stack that combines Next.js, Self, TRPC, and more.

## Features

- **TypeScript** - For type safety and improved developer experience
- **Next.js** - Full-stack React framework
- **TailwindCSS** - Utility-first CSS for rapid UI development
- **Shared UI package** - shadcn/ui primitives live in `packages/ui`
- **tRPC** - End-to-end type-safe APIs
- **Drizzle** - TypeScript-first ORM
- **PostgreSQL** - Database engine
- **Authentication** - Better-Auth
- **Turborepo** - Optimized monorepo build system

## Instalação local

O projeto exige Node.js com npm, Python com o comando `py` disponível e Docker
Desktop em execução. Todos os comandos abaixo são executados na raiz do
repositório.

### 1. Instalar dependências e preparar os arquivos locais

```powershell
npm install
Copy-Item apps/web/.env.example apps/web/.env
Copy-Item apps/ai-engine/.env.example apps/ai-engine/.env
```

Gere um valor seguro para `BETTER_AUTH_SECRET` e substitua o placeholder em
`apps/web/.env`:

```powershell
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Defina também um mesmo valor não vazio de `AI_WEBHOOK_SECRET` nos dois arquivos
`.env`. Ele permite que apenas o AI Engine local registre eventos no frontend.
Os arquivos `.env` são individuais da máquina e não devem ser commitados.

### 2. Iniciar e atualizar o banco

O PostgreSQL local usa Docker e já inclui a extensão `pgvector` necessária para
os embeddings dos pets.

```powershell
npm run db:start
npm run db:push
```

Para confirmar o banco, abra o DBeaver em
`postgresql://postgres:password@localhost:5433/tccpet` ou execute:

```powershell
docker compose -f packages/db/docker-compose.yml exec postgres psql -U postgres -d tccpet -c "\dx vector"
```

`db:push` aplica o estado atual dos esquemas a um banco já existente; portanto,
deve ser executado após receber alterações de banco por `git pull`.

### 3. Preparar o AI Engine

O motor usa um ambiente virtual Python local. Crie-o e instale as dependências
uma única vez por máquina:

```powershell
py -m venv apps/ai-engine/.venv
.\apps\ai-engine\.venv\Scripts\python.exe -m pip install -r .\apps\ai-engine\requirements.txt
```

Em computadores sem GPU NVIDIA, o motor continua funcionando em CPU. O primeiro
uso pode baixar os pesos dos modelos e levar mais tempo; não é necessário CUDA
para executar o projeto ou os testes.

### 4. Iniciar o sistema

```powershell
npm run dev
```

Abra [http://localhost:3001](http://localhost:3001). O comando sobe Next.js em
`3001` e FastAPI em `8000`. Para iniciar apenas uma parte, use `npm run dev:web`
ou `npm run dev:ai`.

## Validação local

```powershell
npm run check-types
npm run test:ai
npm run evaluate:identification
```

- `check-types` confere os tipos TypeScript do monorepo.
- `test:ai` executa os testes automatizados do AI Engine, sem abrir câmera ou
  banco.
- `evaluate:identification` avalia as fotos de referência já cadastradas no
  banco. São dados de diagnóstico; o comando não treina um novo modelo.

## Problemas frequentes

- **`turbo is not recognized`**: execute `npm install` na raiz após clonar.
- **`url: ''` ao usar `db:push`**: confirme que `apps/web/.env` existe, que
  `DATABASE_URL` está preenchida e que o comando é executado na raiz.
- **AI Engine não inicia**: confirme a existência de
  `apps/ai-engine/.venv/Scripts/python.exe`; se não existir, execute a etapa 3.
- **O painel informa que o motor não respondeu**: mantenha `npm run dev` aberto
  e acesse `http://localhost:8000/status` para confirmar que o AI Engine está
  ativo.
- **O feed está preto**: salve uma câmera e marque-a como padrão antes de
  iniciar o monitoramento. A fonte selecionada na tela só passa a ser usada pelo
  feed depois de salva.

## Câmera padrão do feed

Em **Câmeras**, use **Definir padrão** na câmera desejada. A escolha fica salva
por usuário, passa a ser usada pelo feed da página inicial e é iniciada
automaticamente ao abrir o dashboard. A primeira câmera salva já é marcada como
padrão; se a câmera padrão for excluída, a câmera salva mais recente assume essa
função.

## UI Customization

React web apps in this stack share shadcn/ui primitives through `packages/ui`.

- Change design tokens and global styles in `packages/ui/src/styles/globals.css`
- Update shared primitives in `packages/ui/src/components/*`
- Adjust shadcn aliases or style config in `packages/ui/components.json` and `apps/web/components.json`

### Add more shared components

Run this from the project root to add more primitives to the shared UI package:

```bash
npx shadcn@latest add accordion dialog popover sheet table -c packages/ui
```

Import shared components like this:

```tsx
import { Button } from "@tccpet/ui/components/button";
```

### Add app-specific blocks

If you want to add app-specific blocks instead of shared primitives, run the shadcn CLI from `apps/web`.

## Project Structure

```
tccpet/
├── apps/
│   └── web/         # Fullstack application (Next.js)
├── packages/
│   ├── ui/          # Shared shadcn/ui components and styles
│   ├── api/         # API layer / business logic
│   ├── auth/        # Authentication configuration & logic
│   └── db/          # Database schema & queries
```

## Available Scripts

- `npm run dev`: Start all applications in development mode
- `npm run build`: Build all applications
- `npm run dev:web`: Start only the web application
- `npm run check-types`: Check TypeScript types across all apps
- `npm run db:push`: Push schema changes to database
- `npm run db:generate`: Generate database client/types
- `npm run db:migrate`: Run database migrations
- `npm run db:studio`: Open database studio UI

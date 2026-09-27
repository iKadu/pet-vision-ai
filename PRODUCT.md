# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Pessoas que acompanham seus cães e gatos em casa e precisam configurar e consultar
o monitoramento por câmera sem conhecimento técnico de visão computacional.

## Product Purpose

O PetVision AI permite cadastrar pets, relacionar fotos de referência e acompanhar
uma câmera local para detectar presença, identificação e atividade. O sucesso do
produto é o usuário entender o estado recente do pet e receber um alerta útil quando
ele deixa o enquadramento.

## Positioning

O sistema combina identificação visual baseada nas referências cadastradas pelo
próprio usuário, rastreamento no vídeo e um painel de operação local, em vez de
exigir um serviço de câmera proprietário.

## Operating Context

O usuário cadastra pets e câmeras, define uma câmera padrão e acompanha o feed no
dashboard. Os ajustes de ausência e notificações pertencem ao contexto de
monitoramento; parâmetros de desempenho e modelo de IA permanecem configurações
técnicas da instalação local.

## Capabilities and Constraints

- Autenticação, pets, câmeras e eventos são isolados por usuário.
- O projeto usa Next.js, tRPC, Drizzle/PostgreSQL com pgvector e FastAPI.
- O AI Engine é local e processa uma fonte de vídeo ativa por vez.
- O escopo monitora presença e ausência no enquadramento, sem zonas por polígono.
- Notificações de navegador exigem permissão explícita; alertas externos com o
  sistema fechado não pertencem ao escopo atual.

## Brand Commitments

PetVision deve parecer uma ferramenta doméstica confiável, objetiva e acolhedora.
O produto usa linguagem clara em português e evita expor detalhes técnicos ao fluxo
principal do usuário.

## Evidence on Hand

O repositório contém o dashboard funcional, o feed com identificação visual, fotos
de referência cadastradas e testes automatizados do AI Engine. Não há base própria
para fine-tuning nem serviço de notificações externas.

## Product Principles

- Priorizar alertas compreensíveis e evitar ruído por falsas oscilações.
- Separar controles de uso cotidiano de parâmetros técnicos do motor.
- Mostrar o estado do monitoramento de forma verificável e persistente.
- Preservar privacidade e propriedade dos dados por usuário.

## Accessibility & Inclusion

As telas devem preservar navegação por teclado, rótulos associados aos campos,
feedback de salvamento legível e contraste compatível com a interface existente.

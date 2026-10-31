# Avaliação e exportação da identificação

Este documento explica como o PetVision gera as curvas e os arquivos de
evidência disponíveis no painel de **Relatórios**. O objetivo é tornar a
avaliação reproduzível e evitar que resultados internos sejam interpretados
como validação final do TCC.

## 1. O que é avaliado

O PetVision não classifica diretamente uma imagem como “Mala”, “Gui” ou outro
nome. Para cada foto de referência cadastrada, o OpenCLIP produz um vetor
numérico normalizado, chamado **embedding**. A identificação compara o
embedding de uma imagem com os embeddings já armazenados dos perfis.

Na avaliação, o sistema forma pares de referências compatíveis do usuário
autenticado, mantendo apenas amostras com a mesma espécie, modelo, pesos e
dimensão de embedding.

- **Par positivo:** duas fotos do mesmo cão.
- **Par negativo:** fotos de cães diferentes.
- **Similaridade:** proximidade entre os embeddings do par.

O algoritmo percorre os limiares de similaridade observados. Em cada limiar,
considera que um par é positivo quando a similaridade é maior ou igual ao
valor analisado e calcula os acertos e erros resultantes.

Essa análise usa somente referências do próprio cadastro e não envia imagens
nem embeddings a serviços externos durante a geração do relatório.

## 2. Como gerar pelo painel

1. Cadastre pelo menos dois cães e mantenha duas ou mais fotos de referência
   em cada perfil.
2. Acesse **Relatórios** no dashboard.
3. Na seção **Validação da identificação**, selecione **Gerar avaliação**.
4. Confira as métricas e curvas exibidas.
5. Use os botões de exportação para salvar as evidências da rodada.

O cálculo é executado sob demanda pelo backend com o usuário autenticado. Ele
é somente de leitura: não cria eventos, não altera pets, câmeras, embeddings
ou configurações do monitoramento.

Se faltarem pares positivos ou negativos, as métricas ROC e
Precisão–Revocação não podem ser calculadas. O painel informa essa condição e
mantém apenas a exportação JSON disponível para inspeção.

## 3. Métricas e gráficos

### 3.1 Curva ROC e AUC

A curva ROC relaciona a **taxa de verdadeiros positivos** (sensibilidade) com
a **taxa de falsos positivos** ao variar o limiar de similaridade.

- **AUC:** área sob a curva ROC. Quanto mais próxima de 1, maior a separação
  observada entre pares do mesmo cão e de cães diferentes.
- **Linha diagonal:** referência de comportamento aleatório.
- **Limiar de Youden:** ponto destacado que maximiza
  `sensibilidade + especificidade − 1` nos pares analisados. É uma referência
  de calibração, não uma substituição automática da configuração de produção.

### 3.2 Curva Precisão–Revocação e AP

A curva de Precisão–Revocação relaciona:

- **Precisão:** entre os pares aceitos como iguais, quantos realmente são do
  mesmo cão.
- **Revocação:** entre todos os pares do mesmo cão, quantos foram aceitos.
- **AP (Average Precision):** resumo da curva; valores maiores indicam melhor
  equilíbrio de precisão ao recuperar os pares positivos.

Ela é especialmente útil quando existem mais pares negativos do que positivos,
cenário comum quando há vários cães cadastrados. A linha tracejada representa
a proporção de pares positivos da rodada.

## 4. Arquivos exportados

| Arquivo | Finalidade | Conteúdo |
| --- | --- | --- |
| `petvision-curva-roc-AAAA-MM-DD.svg` | Inserção vetorial na monografia | ROC, AUC, pares, limiar de Youden e data de geração |
| `petvision-curva-roc-AAAA-MM-DD.png` | Uso em apresentação ou editores sem suporte a SVG | Mesma ROC em resolução ampliada |
| `petvision-curva-precisao-revocacao-AAAA-MM-DD.svg` | Inserção vetorial na monografia | Curva P-R, AP, prevalência, pares e limiar |
| `petvision-curva-precisao-revocacao-AAAA-MM-DD.png` | Uso em apresentação ou editores sem suporte a SVG | Mesma curva P-R em resolução ampliada |
| `petvision-avaliacao-identificacao-AAAA-MM-DD.json` | Auditoria e reprocessamento | Dados da avaliação, parâmetros exibidos e data de exportação |

Os gráficos exportados usam fundo claro para facilitar a inserção no texto
acadêmico, independentemente do tema selecionado no dashboard. SVG é a opção
preferencial para a monografia, pois não perde definição ao redimensionar.

## 5. Como registrar uma rodada

Para cada exportação utilizada na monografia, guarde os arquivos em uma pasta
local datada e registre junto deles:

- data e hora;
- hash completo do commit (`git rev-parse HEAD`);
- estado limpo do repositório (`git status --short`);
- quantidade de cães e referências válidas mostrada no painel;
- modelo, pesos e dimensão de embedding presentes no JSON;
- limiar de similaridade e margem configurados;
- origem das fotos e autorização de uso.

Os arquivos de evidência podem ficar fora do Git quando contiverem imagens ou
dados identificáveis. Versione no repositório somente scripts, modelos vazios
de coleta e resultados anonimizados.

## 6. Limites da interpretação

As curvas atuais são uma **avaliação interna das referências cadastradas**. Em
outras palavras, a mesma base de fotos participa da construção dos perfis e da
comparação por pares. Esse resultado é útil para verificar a separação visual
do cadastro e para orientar limiares, mas não mede sozinho a capacidade do
sistema em fotos ou vídeos inéditos.

Para a validação final do TCC, mantenha fotos de **consulta independentes**:
elas não devem ser cadastradas como referência. A partir delas será possível
medir identificação Top-1, falsas identificações, ambiguidades e rejeições em
condições próximas ao uso real. Consulte também
[`VALIDACAO_EXPERIMENTAL.md`](./VALIDACAO_EXPERIMENTAL.md).

## 7. Componentes técnicos envolvidos

| Componente | Responsabilidade |
| --- | --- |
| `packages/api/src/routers/reports.ts` | Consulta protegida que limita a avaliação ao usuário autenticado |
| `packages/api/src/evaluation/identification-evaluation.ts` | Filtra amostras compatíveis, forma pares e calcula a avaliação |
| `packages/api/src/evaluation/verification-metrics.ts` | Calcula pontos ROC/P-R, AUC, AP e limiar de Youden |
| `packages/api/src/evaluation/verification-chart-export.ts` | Gera SVGs acadêmicos reutilizados pelo painel e pelo script |
| `apps/web/src/components/identification-evaluation-panel.tsx` | Exibe métricas, curvas e exporta SVG, PNG e JSON no navegador |
| `scripts/evaluate-pet-identification.ts` | Avaliação de linha de comando para diagnósticos e automação local |

Os testes de `npm run test:evaluation` verificam o cálculo das métricas, a
separação por usuário/modelo e a geração dos SVGs. Eles não substituem os
experimentos com dados independentes.

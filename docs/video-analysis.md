# Análise de presença em vídeos

Abra **Vídeos** no menu do dashboard autenticado. Inicie o projeto com `npm run dev` e envie MP4, WebM, MOV ou AVI (até 200 MB, 10 minutos e 4K). MP4/H.264 é recomendado para reprodução no navegador.

O motor decodifica o vídeo sequencialmente e executa YOLO11n para a classe COCO 16 (cachorro), com confiança 0,25, tamanho de inferência 768 e amostragem próxima de 5 FPS. Uma instância separada do detector preserva o estado do monitoramento ao vivo. Apenas uma análise de arquivo é aceita por vez. Processar junto da câmera pode reduzir o desempenho de ambos.

As caixas são desenhadas sobre a gravação original durante a reprodução, usando os resultados da amostra correspondente. Não é gerado um novo arquivo de vídeo com caixas incorporadas. MOV/AVI podem ser analisáveis pelo OpenCV sem serem reproduzíveis pelo navegador.

Os intervalos representam amostras consecutivas com cachorro detectado, sem tolerância adicional para oclusão. Cada amostra representa o intervalo até a seguinte. São estimativas; movimentos entre amostras podem ser perdidos. Não são identificação individual, contagem de indivíduos únicos ou confirmação da ausência física do cachorro.

O JSON exporta tempos, caixas normalizadas, escores, intervalos, configurações e informações do ambiente. O CSV contém tempo do vídeo, número de caixas e maior escore de cada amostra. FPS de processamento mede amostras analisadas por segundo, incluindo decodificação; não é FPS da câmera nem benchmark de tempo real. A aplicação não calcula precisão ou revocação sem anotações humanas.

Uploads são temporários e apagados ao terminar, inclusive em falhas tratadas. Resultados ficam na memória do motor por até uma hora (limpeza no próximo upload), são acessados pela sessão do usuário e desaparecem ao reiniciar o serviço. Exportar antes de sair da tela. O motor deve permanecer restrito à máquina/rede de desenvolvimento, como os endpoints locais existentes; a autenticação da aplicação ocorre no proxy Next.js.

## Protocolo inicial para o TCC

1. Separe vídeos de ajuste e vídeos de avaliação, preferencialmente com sessões de gravação diferentes.
2. Inclua cenas sem cachorro, entradas e saídas, oclusões, movimento, pouca iluminação e múltiplos cachorros. Registre autorização, animais, ambiente e duração.
3. Antes de consultar as saídas, anote os intervalos de presença visual e, para avaliar localização, caixas em quadros selecionados.
4. Exporte JSON e CSV, registre commit do código e hardware (CPU, GPU, RAM), e preserve os vídeos originais e as anotações.
5. Compare presença por amostra com a referência para obter VP, FP, FN, precisão, revocação e F1. Para avaliar caixas, defina previamente IoU e associação entre caixas. Ausência de anotação de caixas não permite calcular qualidade de localização.
6. Analise falhas e tempos separadamente por cenário. Complete com câmera ao vivo para avaliar a afirmação de tempo real.

Verificação automatizada: `npm run test:ai` e `npm run check-types`. O teste de vídeo usa uma gravação sintética e um detector controlado para conferir decodificação e timestamps; não demonstra acurácia visual.

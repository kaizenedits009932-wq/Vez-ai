# VEX AI Studio

MVP de editor de vídeo por instruções. A pessoa envia um clip, descreve o estilo e o servidor pede à IA um plano de edição. O FFmpeg renderiza o resultado.

## Requisitos
- Node.js 18+
- FFmpeg instalado e disponível no PATH
- Uma chave de API da OpenAI (fica apenas no servidor)

## Rodar no computador
1. Instale Node.js e FFmpeg.
2. Extraia o projeto.
3. Na pasta do projeto, rode `npm install`.
4. Copie `.env.example` para `.env` e preencha `OPENAI_API_KEY`.
5. Rode `npm start`.
6. Abra `http://localhost:3000`.

## Publicar
Publique em um serviço que aceite Node.js e tenha FFmpeg instalado. Configure `OPENAI_API_KEY` nas variáveis secretas do serviço. Não publique o arquivo `.env` e não coloque a chave no `index.html`.

## O que esta versão faz
- Upload de vídeo e música opcional.
- Prompt em português interpretado pela IA.
- Ajustes de cor, nitidez, vinheta, zoom, rotação leve e velocidade.
- Saída MP4 com opção de formato vertical, quadrado ou paisagem.

## Limites honestos
Esta é uma primeira versão funcional de edição automatizada, não uma cópia integral do After Effects. Ela aplica efeitos de FFmpeg conforme o pedido interpretado. Recursos como detecção de batidas, cortes inteligentes por cena, tracking de rosto/objeto, geração de efeitos visuais complexos e renderização generativa exigem módulos e serviços adicionais. A música enviada substitui o áudio original nesta versão.

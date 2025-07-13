# 🚀 Groq MCP Server

Um servidor **Model Context Protocol (MCP)** inteligente e completo, projetado para integrar sua aplicação com a poderosa API Groq, oferecendo acesso otimizado aos modelos de IA mais rápidos do mundo.

Atua como uma ponte inteligente, permitindo que clientes compatíveis (como o Claude Desktop) utilizem os diversos modelos da Groq para completação de texto, transcrição de áudio, análise de visão e processamento em lote.

## ✨ Características Principais

### 🧠 **Modelos Suportados**
Este servidor está configurado para gerenciar e rotear requisições para uma ampla gama de modelos Groq, incluindo:
* **Completamento de Texto (LLMs):**
    * `llama-3.1-8b-instant`
    * `llama-3.3-70b-versatile`
    * `deepseek-r1-distill-llama-70b`
    * `qwen/qwen3-32b` (e `qwen-qwq-32b` para matemática)
    * `compound-beta`, `compound-beta-mini`
    * `allam-2-7b`, `gemma2-9b-it`, `llama3-70b-8192`, `llama3-8b-8192`
    * `mistral-saba-24b`
* **Segurança (Prompt/Content Guard):**
    * `meta-llama/llama-guard-4-12b`
    * `meta-llama/llama-prompt-guard-2-22m`, `meta-llama/llama-prompt-guard-2-86m`
* **Visão (Multimodal):**
    * `meta-llama/llama-4-maverick-17b-128e-instruct`
    * `meta-llama/llama-4-scout-17b-16e-instruct`
* **Áudio (Speech-to-Text):**
    * `whisper-large-v3`, `whisper-large-v3-turbo`
    * `distil-whisper-large-v3-en`
* **Texto para Fala (Text-to-Speech):**
    * `playai-tts`, `playai-tts-arabic`

### ⚡ **Recursos Avançados**

* **Roteamento Inteligente (ModelRouter)**: Seleção dinâmica do modelo ideal com base em prioridades (velocidade, qualidade, custo, raciocínio, matemática, multilíngue), complexidade do prompt e capacidades específicas (visão, áudio).
* **Rate Limiting Controlado**: Gerenciamento inteligente de limites de requisições e tokens por minuto (RPM/TPM) configuráveis para cada modelo, otimizando o uso da API.
* **Cache Otimizado**: Sistema de cache em memória com TTL (Time-To-Live) configurável para respostas de LLMs, reduzindo latência e chamadas redundantes à API.
* **Métricas Detalhadas**: Coleta abrangente de métricas de uso, desempenho (latência, throughput), erros e distribuição de modelos para análise e monitoramento.
* **Tratamento de Erros Robusto**: Sistema centralizado de tratamento de erros com capacidade de re-tentativas automáticas (retry) para requisições de API, aumentando a resiliência.
* **Processamento em Lote**: Suporte à ferramenta de processamento em lote da Groq, permitindo o envio eficiente de grandes volumes de requisições com economia de custo.
* **Logging Estruturado e Depuração**: Sistema de logs profissional com Winston, que gera logs estruturados e direciona a saída colorida para `stderr` em desenvolvimento, facilitando a depuração e o monitoramento.

## 🛠️ Instalação

### Pré-requisitos
* **Node.js**: Versão `v20.17.0` ou superior, ou `v22.9.0` ou superior. Recomenda-se usar [NVM](https://github.com/nvm-sh/nvm) (ou [nvm-windows](https://github.com/coreybutler/nvm-windows)) para gerenciar as versões do Node.js.
* **npm**: Gerenciador de pacotes Node.js (geralmente incluído com o Node.js e compatível com as versões recomendadas).
* **TypeScript**: Versão 5 ou superior.
* **Chave API do Groq**: Necessária para autenticar as requisições à API Groq. Obtenha a sua em [https://console.groq.com/keys](https://console.groq.com/keys).

### Instalação Rápida

1.  **Clone o repositório:**
    ```bash
    git clone [https://github.com/AyrtonFelipe/GroqCloud-MCP_server.git]
    cd groq-mcp-server
    ```

2.  **Instale as dependências do projeto:**
    ```bash
    npm install
    # Instale também a biblioteca para conversão de schemas Zod para JSON Schema
    npm install zod-to-json-schema
    ```

3.  **Configure as variáveis de ambiente:**
    Crie um arquivo `.env` na raiz do projeto (se não existir, você pode copiar do `.env.example` se fornecido):
    ```bash
    cp .env.example .env
    ```
    Edite o arquivo `.env` com sua chave API do Groq:
    ```
    GROQ_API_KEY="sua_chave_api_groq_aqui"
    ```
    *(Opcional: configure outras variáveis como `LOG_LEVEL` conforme necessário.)*

4.  **Atualize `src/config/models.json`:**
    Este arquivo define os modelos Groq que seu servidor irá usar e expor.
    * **Remova** entradas de modelos que não estão mais disponíveis ou que não se deseja usar (verifique as listas mais recentes no console Groq).
    * **Adicione** todos os modelos da lista de "Modelos Suportados" (acima) que ainda não estão presentes. Para cada novo modelo, você deve **preencher todas as suas propriedades** (nome, descrição, capacidades, `costPer1kTokens`, `rateLimits`, etc.) consultando a [documentação oficial da Groq](https://console.groq.com/docs/) para obter os valores precisos.
    * **Ajuste as seções `modelSelectionRules` e `complexityThresholds`** em `models.json` para refletir os modelos que você tem e a lógica de seleção desejada (ex: para prioridades de `reasoning`, `mathematical`, `multilingual`).

5.  **Atualize `src/config/constants.ts`:**
    * Sincronize a constante `RATE_LIMITS` com os modelos presentes no seu `models.json`. Certifique-se de que cada modelo em `models.json` tenha uma entrada correspondente em `RATE_LIMITS` com `rpm` (requests per minute) e `tpm` (tokens per minute) precisos (consulte a documentação da Groq para os valores mais recentes).
    * Atualize também os `z.enum` nos arquivos das suas ferramentas (`src/tools/*.ts`) para incluir os novos modelos que você deseja expor ao cliente.

6.  **Compile o projeto:**
    ```bash
    npm run build
    ```

7.  **Inicie o servidor:**
    ```bash
    npm start
    ```
    Seu servidor estará ativo e aguardando conexões via `stdin/stdout`.

## 🤝 Uso com o Claude Desktop

Uma vez que seu servidor MCP esteja rodando localmente, o Claude Desktop deve ser capaz de descobri-lo e usar suas ferramentas:

1.  **Inicie o Claude Desktop.**
2.  **Verifique as Ferramentas:** As ferramentas Groq (`groq_text_completion`, `groq_audio_transcription`, `groq_vision_analysis`, `groq_batch_processing`) devem aparecer ativadas na interface do Claude Desktop (geralmente no menu de ferramentas ou integração).
3.  **Interaja:** Comece a conversar com o Claude e peça para ele usar as ferramentas. Exemplos:
    * `Use groq_text_completion para gerar um texto sobre as capacidades do Groq para IA.`
    * `Com a ferramenta groq_text_completion, analise os dados financeiros { dados: [100, 250, 80, 400] } e use o modelo: llama-3.3-70b-versatile`
    * `groq_audio_transcription: transcreva o arquivo 'caminho/para/seu/audio.mp3' usando 'whisper-large-v3-turbo'.`
    * `groq_vision_analysis: descreva a imagem em 'https://example.com/sua-imagem.jpg' usando 'meta-llama/llama-4-scout-17b-16e-instruct'.`

## 📊 Estrutura do Projeto

````

.
├── src/
│   ├── config/
│   │   ├── constants.ts         \# Constantes do sistema (RATE\_LIMITS, API\_ENDPOINTS, etc.)
│   │   └── models.json          \# Definições detalhadas dos modelos Groq
│   ├── tools/
│   │   ├── audio-transcription.ts \# Ferramenta para transcrição de áudio
│   │   ├── batch-processing.ts    \# Ferramenta para processamento em lote
│   │   ├── model-router.ts        \# Lógica central para seleção de modelos
│   │   ├── text-completion.ts     \# Ferramenta para completação de texto
│   │   └── vision-analysis.ts     \# Ferramenta para análise de visão
│   │   └── ... (novas ferramentas como Text-to-Speech, se implementadas)
│   ├── types/
│   │   └── groq-types.ts          \# Definições de tipos TypeScript para modelos Groq
│   ├── utils/
│   │   ├── cache-manager.ts       \# Gerenciador de cache
│   │   ├── error-handler.ts       \# Tratamento centralizado de erros e retries
│   │   ├── logger.ts              \# Configuração de logging com Winston
│   │   ├── metrics-tracker.ts     \# Coleta de métricas de uso e desempenho
│   │   └── rate-limiter.ts        \# Implementação de rate limiting
│   └── server.ts                  \# Ponto de entrada principal do servidor MCP
├── dist/                          \# Saída da compilação TypeScript
├── logs/                          \# Logs da aplicação
├── .env                           \# Variáveis de ambiente (ex: GROQ\_API\_KEY)
├── .gitignore                     \# Arquivos e pastas a serem ignorados pelo Git
├── package.json                   \# Metadados e dependências do projeto
├── tsconfig.json                  \# Configurações do compilador TypeScript
└── README.md                      \# Este arquivo

```

## 📈 Próximos Passos (Escalabilidade para Web)

Este projeto está configurado para uso local com `StdioServerTransport`. Para escalar para um ambiente de servidor web (e.g., produção), as seguintes considerações seriam cruciais:

* **Transporte de Comunicação:** Migrar de `StdioServerTransport` para um transporte web como **Server-Sent Events (SSE)** ou WebSockets para comunicação com clientes web.
* **Mecanismo de Start:** Adaptar o ciclo de vida do servidor para um framework web (e.g., Express, Fastify) que escuta em portas HTTP/HTTPS.
* **Protocolagem:** Implementar rotas HTTP que mapeiam para chamadas JSON-RPC do MCP.
* **Segurança:** Adicionar autenticação (e.g., JWT), autorização, HTTPS, e configuração de CORS para proteger o servidor.
* **Escalabilidade:** Implementar estratégias para lidar com múltiplos clientes e alto tráfego (e.g., load balancing, clusters Node.js, caches distribuídos como Redis para `CacheManager` e `RateLimiter`).

---

**Desenvolvido por Ayrton Felipe.**

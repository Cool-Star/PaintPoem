import OpenAI from 'openai';

export interface LLMSettings {
  llmUrl: string;
  llmKey: string;
  llmModel: string;
}

export async function requestTextCompletion(
  settings: LLMSettings,
  messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  timeoutMs = 120_000,
): Promise<string> {
  const baseURL = settings.llmUrl.trim();
  const apiKey = settings.llmKey.trim();
  const model = settings.llmModel.trim() || 'gpt-3.5-turbo';
  if (!baseURL || !apiKey) {
    throw new Error('请先填写文本大模型的 Base URL 和 API Key');
  }

  let endpoint: URL;
  try {
    endpoint = new URL(baseURL);
  } catch {
    throw new Error('请输入有效的文本大模型 Base URL');
  }
  if (!['http:', 'https:'].includes(endpoint.protocol) || endpoint.username || endpoint.password) {
    throw new Error('文本大模型 Base URL 须为 HTTP 或 HTTPS 地址，且不含登录凭据');
  }

  let completion: OpenAI.Chat.Completions.ChatCompletion;
  try {
    const client = new OpenAI({
      baseURL,
      apiKey,
      dangerouslyAllowBrowser: true,
      timeout: timeoutMs,
      maxRetries: 0,
      logLevel: 'off',
    });
    completion = await client.chat.completions.create({ model, messages });
  } catch (error) {
    if (error instanceof OpenAI.APIConnectionTimeoutError) {
      throw new Error('文本大模型响应超时，请检查网络或稍后再试');
    }
    if (error instanceof OpenAI.APIConnectionError) {
      throw new Error('无法连接文本大模型，请检查 Base URL、网络和服务访问权限');
    }
    if (error instanceof OpenAI.APIError) {
      const { status } = error;
      switch (status) {
        case 400:
        case 422:
          throw new Error(`文本大模型拒绝了请求（HTTP ${status}），请检查模型是否支持 Chat Completions`);
        case 401:
        case 403:
          throw new Error(`文本大模型鉴权失败（HTTP ${status}），请检查 API Key 和模型权限`);
        case 404:
          throw new Error('未找到文本模型或接口（HTTP 404），请检查模型名称和 Base URL');
        case 429:
          throw new Error('文本大模型请求受限（HTTP 429），请检查用量额度或稍后再试');
      }
      if (status) {
        throw new Error(`文本大模型请求失败（HTTP ${status}）`);
      }
    }
    throw new Error('文本大模型请求失败，请检查配置或稍后再试');
  }

  const content = completion?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('文本大模型未返回文字，请检查模型是否支持 Chat Completions');
  }
  return content.trim();
}

export type Provider = 'openai' | 'anthropic';

export function providerForModel(model: string, provider?: Provider): Provider {
  return provider ?? (model.startsWith('claude') ? 'anthropic' : 'openai');
}

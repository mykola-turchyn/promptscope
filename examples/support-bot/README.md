# Example: support bot

A small support bot for a made-up product. It answers 10 customer questions with a real model and
sends every answer to Promptscope as a trace:

- `kb.search`: a retrieval span that finds articles in a small knowledge base;
- `anthropic.messages` or `openai.chat.completions`: the model call, with tokens and cost;
- `retrieval_hit`: a score, 1 when an article was found and 0 when not (two questions have no
  article on purpose).

## Run it

1. Start Promptscope with `pnpm dev` and sign up at http://localhost:5173.
2. In your project open Settings → API keys and create a key.
3. Copy `.env.example` to `.env` here and fill in the Promptscope key and an Anthropic or OpenAI key.
4. From the repository root run `pnpm example`.

One run makes 10 model calls. With the defaults that costs roughly $0.05–0.10 on `claude-opus-5-5`
and under $0.01 on `gpt-4.1-mini`. Set `MODEL` in `.env` to try another model.

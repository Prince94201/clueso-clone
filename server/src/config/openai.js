// Provider-agnostic chat client.
// Uses Groq when GROQ_API_KEY is set (recommended for free-tier), otherwise uses OpenAI.

const OpenAI = require('openai');
let Groq;

function getProvider() {
  if (process.env.GROQ_API_KEY) return 'groq';
  if (process.env.OPENAI_API_KEY) return 'openai';
  return 'none';
}

function getClient() {
  const provider = getProvider();
  if (provider === 'groq') {
    Groq = Groq || require('groq-sdk');
    return { provider, client: new Groq({ apiKey: process.env.GROQ_API_KEY }) };
  }
  if (provider === 'openai') {
    return { provider, client: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }) };
  }
  return { provider, client: null };
}

async function chatCompletionsCreate(params) {
  const { provider, client } = getClient();
  if (!client) {
    throw Object.assign(new Error('No LLM API key configured. Set GROQ_API_KEY (recommended) or OPENAI_API_KEY.'), {
      status: 401,
    });
  }

  if (provider === 'groq') {
    // groq-sdk shape: client.chat.completions.create({ model, messages, temperature, ... })
    return client.chat.completions.create(params);
  }

  // openai sdk
  return client.chat.completions.create(params);
}

module.exports = {
  chatCompletionsCreate,
  getProvider,
};
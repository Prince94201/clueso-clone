// Import OpenAI from 'openai'
// Initialize with OPENAI_API_KEY from env
// Export configured client instance

const OpenAI = require('openai');

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

module.exports = client;
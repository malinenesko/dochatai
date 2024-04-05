import { ChatOpenAI } from 'langchain/chat_models/openai'
import { BaseChatModel } from 'langchain/dist/chat_models/base'
import { Embeddings } from 'langchain/dist/embeddings/base'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { RUNTIME } from '../constants'
import OpenAI from 'openai'

const getChatLlmModel = (maxTokens = -1, temperature = 0.1, batchSize = 10): BaseChatModel => {
  return new ChatOpenAI({
    modelName: RUNTIME().OPENAI_LLM_MODEL,
    maxRetries: 5,
    temperature,
    maxTokens,
    cache: true,
    verbose: true,
    // n: -1,
    // For experimenting with custom LLMs
    // configuration: {
    //   baseURL: 'http://localhost:1234/v1',
    //   apiKey: 'lm-studio',
    // },
  })
}

const getLlmEmbeddings = (): Embeddings => {
  return new OpenAIEmbeddings() as Embeddings
}

export const LLM = { getLlmModel: getChatLlmModel, getLlmEmbeddings }

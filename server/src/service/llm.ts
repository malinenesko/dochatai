import { ChatOpenAI } from 'langchain/chat_models/openai'
import { BaseChatModel } from 'langchain/dist/chat_models/base'
import { Embeddings } from 'langchain/dist/embeddings/base'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { RUNTIME } from '../constants'

const getLlmModel = (): BaseChatModel => {
  return new ChatOpenAI({
    modelName: RUNTIME().OPENAI_LLM_MODEL,
    temperature: 0.1,
    maxTokens: -1,
    cache: true,
    verbose: true,
  })
}

const getLlmEmbeddings = (): Embeddings => {
  return new OpenAIEmbeddings() as Embeddings
}

export const LLM = { getLlmModel, getLlmEmbeddings }

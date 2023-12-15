import { ChatPromptTemplate, PromptTemplate } from 'langchain/prompts'
import OpenAI from 'openai/index'
import { DocHandler } from './dochandler/dochandler'
import { MilvusClientService } from './vectordb/milvusClient'
import { ResStatus } from '@zilliz/milvus2-sdk-node'

const CHAT_NAME = (process.env.MILVUS_COLLECTION_NAME ?? 'dochatai2') as string

const consumeDocuments = async () => {
  console.log('Running docHandler...')
  await DocHandler.handleDocuments().then((result) => console.log(result))
}

const initChat = async (): Promise<string> => {
  const sessionId = await MilvusClientService.initCollection(CHAT_NAME)
  if (!sessionId) {
    throw new Error(`Failed to initialize chat: ${CHAT_NAME}`)
  }
  return sessionId
}

const template = 'You are a helpful assistant that translates {input_language} into {output_language}.'
const humanTemplate = '{text}'

const chatPrompt = ChatPromptTemplate.fromMessages([
  ['system', template],
  ['human', humanTemplate],
])

const formatMessages = async () => {
  const formattedChatPrompt = await chatPrompt.formatMessages({
    input_language: 'English',
    output_language: 'French',
    text: 'I love programming.',
  })

  return formattedChatPrompt
}

// formatMessages().then((result) => {
//   console.log(result)
// })

// connectToMilvus().then((result) => console.log(result))

export const Chatter = {
  consumeDocuments,
  initChat,
}

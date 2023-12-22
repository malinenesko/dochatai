import { ChatPromptTemplate, PromptTemplate } from 'langchain/prompts'
import OpenAI from 'openai/index'
import { DocHandler } from './dochandler/dochandler'
import { MilvusClientService } from './vectordb/milvusClient'
import { ChatInfo } from '../types'
import { Search } from './vectordb/search'

const COLLECTION_NAME = (process.env.MILVUS_COLLECTION_NAME ?? 'dochatai') as string

const consumeDocuments = async (chatInfo: ChatInfo): Promise<number> => {
  console.log('Running docHandler...')
  return await DocHandler.processUploadedDocuments(chatInfo, COLLECTION_NAME)
}

const initChat = async (): Promise<string> => {
  const sessionId = await MilvusClientService.initCollection(COLLECTION_NAME)
  if (!sessionId) {
    throw new Error(`Failed to initialize chat: ${COLLECTION_NAME}`)
  }
  return sessionId
}

const chatQuestion = async (chat: ChatInfo, question: string): Promise<ChatInfo> => {
  const answer = await Search.search(COLLECTION_NAME, chat, question)
  if (!chat.messages) {
    chat.messages = []
  }
  chat.messages.push({ question, answer })
  return chat
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
  processDocuments: consumeDocuments,
  initChat,
  chatQuestion,
}

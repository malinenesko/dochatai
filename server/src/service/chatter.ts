import { ChatInfo } from '../types'
import { SearchType } from '../types/SearchType'
import { DocHandler, DocumentProcessResult } from './dochandler/dochandler'
import { MilvusClientService } from './vectordb/milvusClient'
import { SearchPredict } from './search/searchPredict'
import { SearchQAChainSimple } from './search/searchQAChainSimple'
import { SearchRunnableSequence } from './search/searchRunnableSequence'
import { RUNTIME } from '../constants'

const COLLECTION_NAME = RUNTIME().MILVUS_COLLECTION_NAME

const processDocuments = async (
  chatInfo: ChatInfo,
  existingSummaries: DocumentProcessResult[],
): Promise<DocumentProcessResult[]> => {
  console.log('Running docHandler...')
  return await DocHandler.processUploadedDocuments(chatInfo, COLLECTION_NAME, existingSummaries)
}

const initChat = async (): Promise<string> => {
  const sessionId = await MilvusClientService.initCollection(COLLECTION_NAME)
  if (!sessionId) {
    throw new Error(`Failed to initialize chat: ${COLLECTION_NAME}`)
  }
  return sessionId
}

/**
 * Executes a chat search function based on the provided parameters. The search type determines the type of search
 * function to be used. If no search type is provided, the default search type is
 * SearchType.QACHAIN. The function searches for an answer using the appropriate search
 * function based on the search type, and adds the question and answer to the chat object's
 * messages array. Finally, the updated chat object is returned.
 *
 * @param {ChatInfo} chat - The chat object containing the conversation history.
 * @param {string} question - The question to be searched.
 * @param {SearchType} searchType - The type of search to be performed. Default is
 *                                 SearchType.QACHAIN.
 * @return {Promise<ChatInfo>} - A promise that resolves to the updated chat object.
 */
const executeQuestion = async (
  chat: ChatInfo,
  question: string,
  searchType: SearchType = SearchType.QACHAIN,
): Promise<ChatInfo> => {
  let searchFn = null
  switch (searchType) {
    case SearchType.PREDICT:
      searchFn = SearchPredict.search
      break
    case SearchType.SEQUENCE:
      searchFn = SearchRunnableSequence.search
      break
    case SearchType.QACHAINSIMPLE:
    case SearchType.QACHAIN:
    default:
      searchFn = SearchQAChainSimple.search
  }
  const answer = await searchFn(COLLECTION_NAME, chat, question)
  if (!chat.messages) {
    chat.messages = []
  }
  chat.messages.push({ question, answer })
  return chat
}

export const Chatter = {
  processDocuments,
  initChat,
  executeQuestion,
}

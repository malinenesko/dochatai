import path from 'path'
import { Document } from 'langchain/document'
import { ChatMessageHistory, ConversationSummaryMemory } from 'langchain/memory'
import { ChatMessage } from '@/src/types/ChatInfo'
import { BaseLanguageModel } from 'langchain/base_language'

const isURL = (source: string): boolean => {
  const urlPattern = /^(https?:\/\/)?([\w.-]+)\.([a-z]{2,})(:\d{1,5})?\/?(\/[^\s]*)?$/i
  return urlPattern.test(source)
}

const getDocumentSource = (source: string) => {
  if (isURL(source)) {
    return source
  }
  return path.basename(source)
}

const formatDocs = (docs: Document[]) =>
  docs
    .map((doc) =>
      JSON.stringify({
        pageContent: doc.pageContent,
        source: getDocumentSource(doc.metadata.source),
        chatId: doc.metadata.chatId,
      }),
    )
    .join('\n')

const listSourceDocs = (docs: Document[]): string =>
  docs
    .map((doc) => {
      return JSON.stringify({ source: getDocumentSource(doc.metadata.source), title: doc.metadata.title })
    })
    .filter((value, index, self) => self.indexOf(value) === index)
    .join('\n')

const createChatMessageHistory = (messages: ChatMessage[], maxLimit: number) => {
  const history = new ChatMessageHistory()

  messages?.slice(-maxLimit).forEach((message) => {
    history.addUserMessage(message.question)
    history.addAIChatMessage(message.answer)
  })

  return history
}

/**
 * Generates a summary for a given array of chat messages.
 *
 * @param {ChatMessage[]} messages - The array of chat messages to generate a summary for.
 * @return {Promise<string>} - The generated summary.
 */
const summarizeMessages = async (model: BaseLanguageModel, messages: ChatMessage[], maxLimit: number = 20) => {
  const summary_memory = new ConversationSummaryMemory({
    llm: model,
    memoryKey: 'chat_history',
    chatHistory: SearchUtils.createChatMessageHistory(messages, maxLimit),
  })

  const summary = await summary_memory.predictNewSummary(await summary_memory.chatHistory.getMessages(), '')
  return summary
}

export const SearchUtils = {
  isURL,
  getDocumentSource,
  formatDocs,
  listSourceDocs,
  createChatMessageHistory,
  summarizeMessages,
}

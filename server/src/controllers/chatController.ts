import { Request, Response, NextFunction } from 'express'
import axios, { AxiosResponse } from 'axios'
import { Chatter } from '../service/chatter'
import { ChatInfo } from '../types'
import { randomInt, randomUUID } from 'crypto'
import { SearchType } from '../types/SearchType'

declare module 'express-session' {
  interface SessionData {
    chatSessionId?: string
    chats?: ChatInfo[] // TODO Change into Map<string, ChatInfo> ?
  }
}

// TODO features in API:
// - implement chat feature, so OpenAI is asked with the context in vector db
// - add chat history to the db (inside the collection or some other way?) to allow longer context
// OPTIONAL:
// - create session / chat (describeCollection to check)
// - add documents asynchronously (need some session store, defaulting to memorystore but is that enough)
// - add check if document processing is done
// - return a list of documents in vector db
// - connect to an old session (by key, cookie, etc)
//

// getting all chats
const getChats = async (req: Request, res: Response, next: NextFunction) => {
  const strippedChats = req.session.chats?.map((chat) => {
    return {
      chatId: chat.chatId,
      chatName: chat.chatName,
    }
  })

  return res.status(200).json({
    chats: strippedChats,
  })
}

/**
 * Process documents.
 *
 */
const processDocuments = async (req: Request, res: Response, next: NextFunction) => {
  // TODO: Add automatic schema validation
  const { chatId } = req.body
  const chatInfo = req.session.chats?.find((chat) => chat.chatId === chatId)
  if (!chatInfo) {
    return res.status(404).json({
      message: 'Chat not found with id: ' + chatId,
    })
  }
  const result = await Chatter.processDocuments(chatInfo)
  console.log('Documents process result: ', result)
  return res.status(200).json({
    processedDocuments: result,
  })
}

/**
 * Creates a new chat in the system.
 *
 * @return The created chat information in JSON format.
 */
const createChat = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { chatName } = req.body
    const sessionId = await Chatter.initChat()
    const chatId = randomUUID()
    const chatInfo: ChatInfo = {
      chatId,
      chatName,
      messages: [],
    }
    req.session.chatSessionId = sessionId
    if (!req.session.chats) {
      req.session.chats = []
    }
    const allChats = req.session.chats
    // Need for this check?
    const existingChat = allChats?.find((chat) => chat.chatId === chatId)
    if (!existingChat) {
      allChats?.push(chatInfo)
    }
    return res.status(200).json(chatInfo)
  } catch (error) {
    console.error(error)
    res.status(500).json({
      error: 'Failed to initialize chat',
    })
  }
}

const getCurrentChat = (chatId: string, chats?: ChatInfo[]): ChatInfo => {
  const chatInfo = chats?.find((chat) => chat.chatId === chatId)
  if (!chatInfo) {
    throw new Error('Chat not found with id: ' + chatId)
  }
  return chatInfo
}

const chatQuestion = async (req: Request, res: Response, next: NextFunction) => {
  const { chatId, question, searchType } = req.body
  if (!chatId || !question) {
    return res.status(400).json({
      message: 'Missing chatId or question',
    })
  }
  try {
    const chatInfo = getCurrentChat(chatId, req.session.chats)
    const result = await Chatter.executeQuestion(chatInfo, question, searchType as SearchType)

    return res.status(200).json({
      chat: result,
    })
  } catch (error) {
    console.error(error)
    res.status(500).json({
      error: 'Failed to send the question',
    })
  }
}

export default { getChats, createChat, processDocuments, chatQuestion }

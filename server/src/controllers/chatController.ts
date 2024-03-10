import { Request, Response, NextFunction } from 'express'
import axios, { AxiosResponse } from 'axios'
import { Chatter } from '../service/chatter'
import { ChatInfo } from '../types'
import { Hash, randomInt, randomUUID } from 'crypto'
import { SearchType } from '../types/SearchType'
import { DocumentProcessResult } from '../service/dochandler/dochandler'
var hash = require('object-hash')

declare module 'express-session' {
  interface SessionData {
    chatSessionId?: string
    chats?: ChatInfo[]
    documentResults?: DocumentProcessResult[]
  }
}

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

const getChatHistory = async (req: Request, res: Response, next: NextFunction) => {
  const foundChat = req.session.chats?.find((chat) => chat.chatId === req.params.id)

  if (!foundChat) {
    return res.status(404).json({
      message: 'Chat not found with id: ' + req.params.id,
    })
  }

  return res.status(200).json({
    chat: foundChat,
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
  const existingSummaries = req.session.documentResults ?? []
  logSummaries('Session summaries before update:', existingSummaries)

  const result = await Chatter.processDocuments(chatInfo, existingSummaries)
  req.session.documentResults = [...existingSummaries, ...result]

  const docinfoList = result.map((result) => result.documentInfo)
  console.log('Documents process result: ', docinfoList)
  logSummaries('Session summaries after update:', req.session.documentResults)

  return res.status(200).json({
    processedDocuments: docinfoList,
  })
}

const logSummaries = (title: string, summaries: DocumentProcessResult[]) => {
  console.log(title)
  console.log(summaries.map((summary) => summary.documentHash))
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

const getSummaries = async (req: Request, res: Response, next: NextFunction) => {
  const strippedSummaries = req.session.documentResults?.map((summary) => {
    return {
      documentHash: summary.documentHash,
      documentInfo: summary.documentInfo,
    }
  })

  return res.status(200).json({
    summaries: strippedSummaries,
  })
}

const getSummaryDetails = async (req: Request, res: Response, next: NextFunction) => {
  const foundSummary = req.session.documentResults?.find((summary) => summary.documentHash === req.params.id)

  if (!foundSummary) {
    return res.status(404).json({
      message: 'Summary not found with id: ' + req.params.id,
    })
  }

  return res.status(200).json({
    summary: foundSummary,
  })
}

export default { processDocuments, getChats, getChatHistory, createChat, chatQuestion, getSummaries, getSummaryDetails }

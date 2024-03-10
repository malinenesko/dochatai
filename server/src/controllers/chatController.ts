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
    documentSummaries?: DocumentProcessResult[]
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
  console.log('Session summaries before update: \n', req.session.documentSummaries)

  const existingSummaries = req.session.documentSummaries ?? []
  const result = await Chatter.processDocuments(chatInfo, existingSummaries)
  req.session.documentSummaries = [...existingSummaries, ...result]

  const docinfoList = result.map((result) => result.documentInfo)
  console.log('Documents process result: ', docinfoList)
  console.log('Session summaries after update: \n', req.session.documentSummaries)
  return res.status(200).json({
    processedDocuments: docinfoList,
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

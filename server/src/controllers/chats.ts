import { Request, Response, NextFunction } from 'express'
import axios, { AxiosResponse } from 'axios'
import { Chatter } from '../service/chatter'
import { ChatInfo } from '../types'
import { randomInt, randomUUID } from 'crypto'

declare module 'express-session' {
  interface SessionData {
    chatSessionId?: string
    chats?: ChatInfo[]
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
  // get some chats
  // let result: AxiosResponse = await axios.get(`https://jsonplaceholder.typicode.com/chats`)
  // let chats: [Chat] = result.data
  // await Chatter.consumeDocuments()
  return res.status(200).json({
    message: req.session.chats,
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
  return res.status(200).json({
    message: result,
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
    }
    req.session.chatSessionId = sessionId
    if (!req.session.chats) {
      req.session.chats = []
    }
    const allChats = req.session.chats
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

const getChat = async (req: Request, res: Response, next: NextFunction) => {
  const { chatId } = req.params
  const result: AxiosResponse = await axios.get(`https://jsonplaceholder.typicode.com/chats/`)
  const chat = result.data
  return res.status(200).json({
    message: chat,
  })
}

// updating a chat
const updateChat = async (req: Request, res: Response, next: NextFunction) => {
  // get the chat id from the req.params
  let id: string = req.params.id
  // get the data from req.body
  let title: string = req.body.title ?? null
  let body: string = req.body.body ?? null
  // update the chat
  let response: AxiosResponse = await axios.put(`https://jsonplaceholder.typicode.com/chats/${id}`, {
    ...(title && { title }),
    ...(body && { body }),
  })
  // return response
  return res.status(200).json({
    message: response.data,
  })
}

// deleting a chat
const deleteChat = async (req: Request, res: Response, next: NextFunction) => {
  // get the chat id from req.params
  let id: string = req.params.id
  // delete the chat
  let response: AxiosResponse = await axios.delete(`https://jsonplaceholder.typicode.com/chats/${id}`)
  // return response
  return res.status(200).json({
    message: 'chat deleted successfully',
  })
}

export default { getChats, getChat, updateChat, deleteChat, createChat, processDocuments }

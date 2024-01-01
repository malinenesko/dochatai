export type ChatAnswer = {
  answerMsg: string
  sourceDocuments: string
}

export type ChatMessage = {
  // userId: number
  // id: number
  question: string
  answer: ChatAnswer
}

export type ChatInfo = {
  chatId: string
  chatName: string
  messages: ChatMessage[]
}

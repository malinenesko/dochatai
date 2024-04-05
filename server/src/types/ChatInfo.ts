export type ChatAnswer = {
  answerMsg: string
  sourceDocuments: string
  generatedQuestion?: string
}

export type ChatMessage = {
  question: string
  answer: ChatAnswer
}

export type ChatInfo = {
  chatId: string
  chatName: string
  messages: ChatMessage[]
}

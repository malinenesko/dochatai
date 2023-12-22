export type ChatMessage = {
  // userId: number
  // id: number
  question: string
  answer: string
}

export type ChatInfo = {
  chatId: string
  chatName: string
  messages: ChatMessage[]
}

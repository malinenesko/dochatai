import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { HumanMessagePromptTemplate, PromptTemplate, SystemMessagePromptTemplate } from 'langchain/prompts'
import { Milvus } from 'langchain/vectorstores/milvus'
import { RunnableSequence, RunnablePassthrough } from 'langchain/schema/runnable'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { StringOutputParser } from 'langchain/schema/output_parser'
import { RUNTIME } from '../../constants'
import { MetricType } from '@zilliz/milvus2-sdk-node'
import { ChatAnswer, ChatInfo } from '@/src/types'
import { SearchUtils } from '../vectordb/util'

const search = async (collectionName: string, chat: ChatInfo, question: string): Promise<ChatAnswer> => {
  const model = new ChatOpenAI({ temperature: 0 })
  const runtime = RUNTIME()
  const dbStore = await Milvus.fromExistingCollection(new OpenAIEmbeddings(), {
    collectionName: runtime.MILVUS_COLLECTION_NAME,
    textField: 'pageContent',
    vectorField: 'vector',
    // url: MILVUS_URL,
    clientConfig: {
      address: runtime.MILVUS_URL,
      token: runtime.MILVUS_TOKEN,
    },
  })
  dbStore.fields.push('chatId', 'source', 'pageContent', 'author', 'title')
  dbStore.indexCreateParams.metric_type = MetricType.IP

  const retriever = dbStore.asRetriever()

  const PROMPT_TEMPLATE = `Answer the given question based on the context, using descriptive language and specific details. 
   List the information and all the sources available from the context metadata field.:
    System: {context}
    ChatId: {chatId}
    Chat history: {chat_history}
    Human: {question}
    AI:`

  const messages = [
    SystemMessagePromptTemplate.fromTemplate(PROMPT_TEMPLATE),
    HumanMessagePromptTemplate.fromTemplate('{question}'),
  ]

  // const prompt = ChatPromptTemplate.fromMessages(messages)
  const prompt = new PromptTemplate({
    inputVariables: ['context', 'question', 'chatId', 'chat_history'],
    template: PROMPT_TEMPLATE,
  })

  // // Handle chat history
  const viewableHistory = chat.messages.slice(-10)
  const chatHistoryAsString = async () =>
    chat.messages.length < 20
      ? viewableHistory.map((message) => `${message.question}: ${message.answer}`).join('\n')
      : await SearchUtils.summarizeMessages(model, chat.messages, 20)

  // console.log('chatHistoryAsString: ', await chatHistoryAsString())

  const documents = await retriever.getRelevantDocuments(question)

  const llmChain = RunnableSequence.from([
    {
      context: retriever.pipe(() => SearchUtils.formatDocs(documents)),
      question: new RunnablePassthrough(),
      chat_history: chatHistoryAsString,
      chatId: () => chat.chatId,
    },
    prompt,
    model,
    new StringOutputParser(),
  ])

  const result = await llmChain.invoke(question)

  dbStore.client.closeConnection()

  const finalResult = result + '\n' + 'Source documents: ' + SearchUtils.listSourceDocs(documents)
  console.log(finalResult)
  return { answerMsg: result, sourceDocuments: SearchUtils.listSourceDocs(documents) }
}

export const SearchRunnableSequence = { search }

import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import {
  ChatPromptTemplate,
  HumanMessagePromptTemplate,
  PromptTemplate,
  SystemMessagePromptTemplate,
} from 'langchain/prompts'
import { Milvus } from 'langchain/vectorstores/milvus'
import { RunnableSequence, RunnablePassthrough } from 'langchain/schema/runnable'
import { ChatOpenAI } from 'langchain/chat_models/openai'
import { StringOutputParser } from 'langchain/schema/output_parser'
import { ConversationalRetrievalQAChain } from 'langchain/chains'
import { RUNTIME } from '../../constants'
import { MetricType } from '@zilliz/milvus2-sdk-node'
import { ChatAnswer, ChatInfo, ChatMessage } from '@/src/types'
import { BufferMemory, ConversationSummaryMemory } from 'langchain/memory'
import { SearchUtils } from './util'

const search = async (collectionName: string, chat: ChatInfo, question: string): Promise<ChatAnswer> => {
  // { openAIApiKey: OPENAI_API_KEY }
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
  // , and if you don't know the answer, say "Beats me, bro
  // what kind of disruptions can be caused by digital transformation
  // ChatId: {chatId}
  const PROMPT_TEMPLATE = `Answer the given question based on the context and chat history, using descriptive language and specific details. 
   List the information and all the sources available from the context metadata field.:
    System: {context}
    Chat history: {chat_history}
    AI:`

  //

  const messages = [
    SystemMessagePromptTemplate.fromTemplate(PROMPT_TEMPLATE),
    HumanMessagePromptTemplate.fromTemplate('{question}'),
  ]

  const retriever = dbStore.asRetriever()
  const model = new ChatOpenAI({})

  // Handle chat history
  // const chatHistoryAsString =
  //   chat.messages.length < 10
  //     ? chat.messages.map((message) => `${message.question}: ${message.answer}`).join('\n')
  //     : await SearchUtils.summarizeMessages(model, chat.messages)
  // console.log('chatHistoryAsString: ', chatHistoryAsString)

  const chatHistory = SearchUtils.createChatMessageHistory(chat.messages, 20)

  const memory = new ConversationSummaryMemory({
    llm: model,
    memoryKey: 'chat_history',
    inputKey: 'question',
    outputKey: 'sourceDocuments',
    chatHistory,
  })

  const prompt = ChatPromptTemplate.fromMessages(messages)
  // const prompt = new PromptTemplate({
  //   inputVariables: ['context', 'question', 'chatId', 'chat_history', 'source'],
  //   template: PROMPT_TEMPLATE,
  // })

  // const history = SearchUtils.createChatMessageHistory(chat.messages)

  const documents = await retriever.getRelevantDocuments(question)
  const formattedContext = SearchUtils.formatDocs(documents)
  const chain = ConversationalRetrievalQAChain.fromLLM(model, retriever, {
    verbose: true,
    returnSourceDocuments: true,
    memory,
    qaChainOptions: {
      type: 'stuff',
      verbose: true,
      prompt: prompt,
    },
  })
  const res = await chain.call({
    question,
    chatId: chat.chatId,
    context: formattedContext,
    chat_history: memory,
  })

  dbStore.client.closeConnection()

  const finalResult = res.text + '\n' + 'Source documents: ' + SearchUtils.listSourceDocs(res.sourceDocuments)
  console.log(finalResult)
  return { answerMsg: res.text, sourceDocuments: SearchUtils.listSourceDocs(res.sourceDocuments) }
}

export const SearchQAChainSimple = { search }

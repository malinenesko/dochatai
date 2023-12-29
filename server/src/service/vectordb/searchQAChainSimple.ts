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
import { ChatInfo, ChatMessage } from '@/src/types'
import { BufferMemory, ConversationSummaryMemory } from 'langchain/memory'
import { SearchUtils } from './util'

const search = async (collectionName: string, chat: ChatInfo, question: string): Promise<string> => {
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
  dbStore.fields.push('chatId', 'source', 'pageContent')
  dbStore.indexCreateParams.metric_type = MetricType.IP
  // , and if you don't know the answer, say "Beats me, bro
  // what kind of disruptions can be caused by digital transformation
  const PROMPT_TEMPLATE = `Answer the given question based on the context and chat history, using descriptive language and specific details. 
   List the information and all the sources available from the context metadata field.:
    ChatId: {chatId}
    System: {context}
    Chat history: {chat_history}
    Human: {question}
    AI:`

  //

  const messages = [
    SystemMessagePromptTemplate.fromTemplate(PROMPT_TEMPLATE),
    HumanMessagePromptTemplate.fromTemplate('{question}'),
  ]

  const retriever = dbStore.asRetriever()

  const model = new ChatOpenAI({})
  const prompt1 = ChatPromptTemplate.fromMessages(messages)
  const prompt = new PromptTemplate({
    inputVariables: ['context', 'question', 'chatId', 'chat_history', 'source'],
    template: PROMPT_TEMPLATE,
  })

  // Handle chat history
  const chatHistoryAsString =
    chat.messages.length < 10
      ? chat.messages.map((message) => `${message.question}: ${message.answer}`).join('\n')
      : await SearchUtils.summarizeMessages(model, chat.messages)

  console.log('chatHistoryAsString: ', chatHistoryAsString)

  // const history = SearchUtils.createChatMessageHistory(chat.messages)

  const documents = await retriever.getRelevantDocuments(question)
  const formattedContext = SearchUtils.formatDocs(documents)
  const chain = ConversationalRetrievalQAChain.fromLLM(model, retriever, {
    verbose: true,
  })
  const res = await chain.call({
    question,
    chatId: chat.chatId,
    context: formattedContext,
    chat_history: chatHistoryAsString,
  })

  dbStore.client.closeConnection()

  const finalResult = res.text + '\n' + 'Source documents: ' + SearchUtils.listSourceDocs(documents)
  console.log(finalResult)
  return finalResult
}

export const SearchQAChainSimple = { search }

import { ChatOpenAI } from 'langchain/chat_models/openai'
import { HNSWLib } from 'langchain/vectorstores/hnswlib'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { PromptTemplate } from 'langchain/prompts'
import { RunnableSequence, RunnablePassthrough } from 'langchain/schema/runnable'
import { StringOutputParser } from 'langchain/schema/output_parser'
import { formatDocumentsAsString } from 'langchain/util/document'
import { ChatAnswer, ChatInfo } from '@/src/types'
import { MetricType } from '@zilliz/milvus2-sdk-node'
import { Milvus } from 'langchain/vectorstores/milvus'
import { RUNTIME } from '../../constants'
import { SearchUtils } from './util'

export const search = async (collectionName: string, chat: ChatInfo, question: string): Promise<ChatAnswer> => {
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

  const prompt = PromptTemplate.fromTemplate(`Answer the question based only on the following context and chat history:
{context}
Chat history: {chat_history}

Question: {question}`)

  const chatHistoryAsString = () => chat.messages.map((message) => `${message.question}: ${message.answer}`).join('\n')
  // const chatHistoryAsString = async () =>
  //   chat.messages.length < 10
  //     ? chat.messages.map((message) => `${message.question}: ${message.answer}`).join('\n')
  //     : await SearchUtils.summarizeMessages(model, chat.messages)

  const chain = RunnableSequence.from([
    {
      context: retriever.pipe(formatDocumentsAsString),
      question: new RunnablePassthrough(),
      chat_history: chatHistoryAsString,
    },
    prompt,
    model,
    new StringOutputParser(),
  ])

  const result = await chain.invoke(question, {
    metadata: {
      verbose: true,
    },
  })

  console.log(result)
  return { answerMsg: result, sourceDocuments: '' }
}

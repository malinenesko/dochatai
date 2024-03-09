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
import { SearchUtils } from '../vectordb/util'

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

  const PROMPT_TEMPLATE = `Answer the given question based on the context and chat history, using descriptive language and specific details. 
   List the information and all the sources available from the context metadata field.:
    ChatId: {chatId}
    System: {context}
    Chat history: {chatHistory}
    Human: {question}
    AI:`

  // const template = 'You are a helpful assistant that translates {input_language} into {output_language}.'
  // const humanTemplate = '{text}'

  // const chatPrompt = ChatPromptTemplate.fromMessages([
  //   ['system', template],
  //   ['human', humanTemplate],
  // ])

  const messages = [
    SystemMessagePromptTemplate.fromTemplate(PROMPT_TEMPLATE),
    HumanMessagePromptTemplate.fromTemplate('{question}'),
  ]

  const retriever = dbStore.asRetriever()

  const model = new ChatOpenAI({})
  const prompt1 = ChatPromptTemplate.fromMessages(messages)
  const prompt = new PromptTemplate({
    inputVariables: ['context', 'question', 'chatId', 'chatHistory', 'source'],
    template: PROMPT_TEMPLATE,
  })

  // Handle chat history
  const chatHistoryAsString =
    chat.messages.length < 10
      ? chat.messages.map((message) => `${message.question}: ${message.answer}`).join('\n')
      : await SearchUtils.summarizeMessages(model, chat.messages)

  console.log('chatHistoryAsString: ', chatHistoryAsString)

  const history = SearchUtils.createChatMessageHistory(chat.messages, 20)
  // const memory = new BufferWindowMemory({
  //   chatHistory: history,
  //   memoryKey: 'chatHistory',
  //   inputKey: 'question',
  //   k: 1000,
  //   returnMessages: true,
  // })
  const memory = new BufferMemory({
    inputKey: 'question',
    chatHistory: history,
    memoryKey: 'chatHistory',
    returnMessages: true,
  })

  // const memory = chat.messages.map((message) => `${message.question}: ${message.answer}`).join('\n')

  // // const chain = ConversationalRetrievalQAChain.fromLLM(model, retriever)
  // const chain1 = new ConversationChain({
  //   memory: memory,
  //   verbose: true, // Just to print everything out so that we can see what is actually happening
  //   llm: model,
  //   prompt: prompt,
  // })
  // const response = await chain1.predict({
  //   question: question,
  //   chatHistory: chatHistoryAsString,
  //   chatId: chat.chatId,
  //   context: formatDocs(await retriever.getRelevantDocuments(question)),
  // })
  // console.log(response)
  // dbStore.client.closeConnection()
  // return response

  // const chatHistory = ConversationalRetrievalQAChain.getChatHistoryString(await history.getMessages())
  // memory,
  // metadata: { chatId: chat.chatId },
  const documents = await retriever.getRelevantDocuments(question)
  const formattedContext = SearchUtils.formatDocs(documents)
  const chain = ConversationalRetrievalQAChain.fromLLM(model, retriever, {
    verbose: true,
  })
  const res = await chain.call({
    question,
    chatId: chat.chatId,
    context: formattedContext,
    chatHistory: chatHistoryAsString,
  })

  console.log(res)
  dbStore.client.closeConnection()

  const finalResult = res.text + '\n' + 'Source documents: ' + SearchUtils.listSourceDocs(documents)
  return finalResult

  const chain2 = RunnableSequence.from([
    // {
    //   context: async (input: { question: string; chatHistory?: string }) => {
    //     const relevantDocs = await retriever.getRelevantDocuments(input.question)
    //     const serialized = formatDocumentsAsString(relevantDocs)
    //     return serialized
    //   },
    //   question: (input: { question: string; chatHistory?: string }) => input.question,
    //   chatHistory: (input: { question: string; chatHistory?: string }) => input.chatHistory ?? '',
    // },
    {
      context: retriever.pipe(SearchUtils.formatDocs),
      question: new RunnablePassthrough(),
      chatHistory: new RunnablePassthrough(),
    },
    prompt,
    model,
    new StringOutputParser(),
  ])

  // const chain2 = RunnableSequence.from([
  //   {
  //     // Extract the "question" field from the input object and pass it to the retriever as a string
  //     sourceDocuments: RunnableSequence.from([(input) => input.question, retriever]),
  //     question: (input) => input.question,
  //   },
  //   {
  //     context: retriever.pipe(formatDocs),
  //     question: new RunnablePassthrough(),
  //   },
  //   prompt,
  //   model,
  //   // new StringOutputParser(),
  //   {
  //     result: prompt.pipe(model).pipe(new StringOutputParser()),
  //     sourceDocuments: (previousStepResult) => previousStepResult.sourceDocuments,
  //   },
  // ])

  const result = await chain2.invoke(question)

  console.log(result)

  dbStore.client.closeConnection()
  return result
}

export const SearchWIP = { search }

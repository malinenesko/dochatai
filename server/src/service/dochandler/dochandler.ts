import { DOCUMENT_TEXT_CHUNK_OVERLAP, DOCUMENT_TEXT_CHUNK_SIZE, RUNTIME } from '../../constants'
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import { Document } from 'langchain/document'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { MilvusClientService } from '../vectordb/milvusClient'
import { InsertReq, MetricType, MilvusClient, ResStatus, RowData, sleep } from '@zilliz/milvus2-sdk-node'
import { ChatInfo } from '@/src/types'
import { Milvus } from 'langchain/vectorstores/milvus'
import { SearchUtils } from '../vectordb/util'

const openAIApiKey = process.env.OPENAI_API_KEY
let milvusClientInstance: MilvusClient

const processUploadedDocuments = async (chatInfo: ChatInfo, collectionName: string): Promise<number> => {
  const filePath = process.env.NODE_ENV === 'production' ? '/tmp' : 'tmp'
  console.log('Env variables', process.env.MILVUS_URL, process.env.MILVUS_TOKEN, filePath, openAIApiKey)

  const documents = await new DirectoryLoader(filePath, {
    '.pdf': (path) => new PDFLoader(path, { splitPages: false }),
  }).load()
  if (documents.length <= 0) {
    return 0
  }

  // processDocuments(documents, chatInfo, collectionName)
  // return 2
  const milvusClient = await MilvusClientService.getMilvusClient()

  const result = await Promise.all(
    documents.map(async (doc) => {
      await sleep(700) // Wait a little bit for Milvus to index
      return await processDocument(doc, chatInfo, collectionName, milvusClient)
    }),
  )
  milvusClient.closeConnection()
  return result.length
}

const processDocuments = async (documents: Document[], chatInfo: ChatInfo, collectionName: string) => {
  const runtime = RUNTIME()
  const dbStore = await Milvus.fromExistingCollection(new OpenAIEmbeddings(), {
    collectionName: 'dochatai',
    // url: MILVUS_URL,
    clientConfig: {
      address: runtime.MILVUS_URL,
      token: runtime.MILVUS_TOKEN,
    },
  })

  dbStore.indexCreateParams.metric_type = MetricType.IP
  await dbStore.addDocuments(documents)

  // const res = await Milvus.fromDocuments(documents, new OpenAIEmbeddings(), {
  //   collectionName: 'dochatai2',
  //   clientConfig: {
  //     address: runtime.MILVUS_URL,
  //     token: runtime.MILVUS_TOKEN,
  //   },
  // })
  // console.log('Document stored: ', res.collectionName, res.indexSearchParams)
}

const processDocument = async (
  document: Document,
  chatInfo: ChatInfo,
  collectionName: string,
  milvusClient: MilvusClient,
) => {
  const splitDocumentParts = await new RecursiveCharacterTextSplitter({
    chunkSize: Number(DOCUMENT_TEXT_CHUNK_SIZE),
    chunkOverlap: Number(DOCUMENT_TEXT_CHUNK_OVERLAP),
  }).splitDocuments([document])
  // console.log('Split document parts: ', splitDocumentParts.length)

  const embeddings = new OpenAIEmbeddings({ openAIApiKey })
  const embeddedDocuments = await embeddings.embedDocuments(splitDocumentParts.map((entry) => entry.pageContent))
  // console.log('EmbeddedDocs: ', embeddedDocuments.length)

  const rowData: RowData[] = embeddedDocuments.map((entry, index) => {
    const documentSource = SearchUtils.getDocumentSource(document.metadata.source)
    return {
      chatId: chatInfo.chatId,
      source: documentSource,
      author: document.metadata.pdf?.info?.Author,
      title: document.metadata.pdf?.info?.Title ?? documentSource,
      pageContent: splitDocumentParts[index].pageContent,
      vector: entry,
    }
  })

  // console.log('RowData: ', rowData.length)
  console.log('RowData 0: ', rowData[0])

  const insertReq: InsertReq = { collection_name: collectionName, data: rowData }
  const result = await milvusClient.insert(insertReq)
  console.log(document.metadata.source, result.status.error_code)

  if (result.status.error_code !== '' && result.status.error_code !== 'Success') {
    throw new Error('Failed to insert document: ' + document.metadata.source)
  }

  return true
}

const getClient = async (): Promise<MilvusClient> => {
  return (milvusClientInstance = milvusClientInstance || (await MilvusClientService.getMilvusClient()))
}

export const DocHandler = {
  processUploadedDocuments,
  processDocument,
}

import { DOCUMENT_TEXT_CHUNK_OVERLAP, DOCUMENT_TEXT_CHUNK_SIZE } from '../../constants'
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import { Document } from 'langchain/document'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { MilvusClientService } from '../vectordb/milvusClient'
import { InsertReq, MilvusClient, ResStatus, RowData } from '@zilliz/milvus2-sdk-node'
import { ChatInfo } from '@/src/types'

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

  const result = await Promise.all(documents.map(async (doc) => await processDocument(doc, chatInfo, collectionName)))

  // const result = await documents.every(async (doc) => await processDocument(doc, chatInfo, collectionName))

  return result.length
}

const processDocument = async (document: Document, chatInfo: ChatInfo, collectionName: string) => {
  const splitDocumentParts = await new RecursiveCharacterTextSplitter({
    chunkSize: Number(DOCUMENT_TEXT_CHUNK_SIZE),
    chunkOverlap: Number(DOCUMENT_TEXT_CHUNK_OVERLAP),
  }).splitDocuments([document])
  console.log('Split document parts: ', splitDocumentParts.length)

  const embeddings = new OpenAIEmbeddings({ openAIApiKey })
  const embeddedDocuments = await embeddings.embedDocuments(splitDocumentParts.map((entry) => entry.pageContent))
  console.log('EmbeddedDocs: ', embeddedDocuments.length)

  const rowData: RowData[] = embeddedDocuments.map((entry, index) => {
    return {
      chatId: chatInfo.chatId,
      source: document.metadata.source,
      text: splitDocumentParts[index].pageContent,
      vector: entry,
    }
  })

  // console.log('RowData: ', rowData.length)
  // console.log('RowData 0: ', rowData[0])

  const milvusClient = await getClient()
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

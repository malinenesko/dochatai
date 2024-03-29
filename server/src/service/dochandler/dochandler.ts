import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import { Document } from 'langchain/document'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { MilvusClientService } from '../vectordb/milvusClient'
import { InsertReq, MilvusClient, RowData, sleep } from '@zilliz/milvus2-sdk-node'
import { ChatInfo } from '@/src/types'
import { SearchUtils } from '../vectordb/util'
import { LLM } from '../llm'
import { Summarizer } from './summarizer'
import { RUNTIME } from '../../constants'
import { ChainValues } from 'langchain/dist/schema'
var hash = require('object-hash')

export type DocumentInfo = {
  source: string
  author: string
  title: string
}

export type DocumentProcessResult = {
  documentHash: string
  documentInfo: DocumentInfo
  summary?: string
}

const processUploadedDocuments = async (
  chatInfo: ChatInfo,
  collectionName: string,
  existingSummaries: DocumentProcessResult[],
): Promise<DocumentProcessResult[]> => {
  const filePath = process.env.NODE_ENV === 'production' ? '/tmp' : 'tmp'
  console.log('Env variables', process.env.MILVUS_URL, process.env.MILVUS_TOKEN, filePath)

  const documents: Document[] = await new DirectoryLoader(filePath, {
    '.pdf': (path) => new PDFLoader(path, { splitPages: false }),
  }).load()
  if (documents.length <= 0) {
    return []
  }

  const milvusClient = MilvusClientService.getMilvusClient()

  const processResults: DocumentProcessResult[] = await Promise.all(
    documents.map(async (doc, index) => {
      const documentInfo = getDocumentInfo(doc, chatInfo)
      const documentHash = hash(documentInfo)
      if (existingSummaries.some((result) => result.documentHash === documentHash)) {
        // Already processed, no summary
        return { documentHash, documentInfo }
      }
      try {
        const processPromise = processDocument(doc, documentInfo, chatInfo.chatId, collectionName, milvusClient)
        const summarizePromise = Summarizer.generateSummary(doc)
        const summary = (await Promise.all([processPromise, summarizePromise]))[1]
        if (index > 0 && index < documents.length) await sleep(1000) // Wait a little bit for Milvus to index
        return { documentHash, documentInfo, summary }
      } catch (error) {
        console.log('Error handling document: ', documentInfo, error)
        return { documentHash, documentInfo }
      }
    }),
  ).then((results) => results.filter((result) => result.summary !== undefined))

  milvusClient.closeConnection()

  return processResults
}

const getDocumentInfo = (document: Document, chatInfo: ChatInfo): DocumentInfo => {
  const documentSource = SearchUtils.getDocumentSource(document.metadata.source)
  return {
    source: documentSource,
    author: document.metadata.pdf?.info?.Author,
    title: document.metadata.pdf?.info?.Title ?? documentSource,
  }
}

const processDocument = async (
  document: Document,
  documentInfo: DocumentInfo,
  chatId: string,
  collectionName: string,
  milvusClient: MilvusClient,
) => {
  const splitDocumentParts: Document[] = await new RecursiveCharacterTextSplitter({
    chunkSize: Number(RUNTIME().VECTOR_DB_DOCUMENT_CHUNK_SIZE),
    chunkOverlap: Number(RUNTIME().VECTOR_DB_DOCUMENT_CHUNK_OVERLAP),
  }).splitDocuments([document])

  const embeddings = LLM.getLlmEmbeddings()
  const embeddedDocuments = await embeddings.embedDocuments(splitDocumentParts.map((entry) => entry.pageContent))

  const rowData: RowData[] = embeddedDocuments.map((entry, index) => {
    return {
      ...documentInfo,
      chatId,
      pageContent: splitDocumentParts[index].pageContent,
      vector: entry,
    }
  })

  const insertReq: InsertReq = { collection_name: collectionName, data: rowData }
  const result = await milvusClient.insert(insertReq)
  console.log(document.metadata.source, result.status.error_code)

  if (result.status.error_code !== '' && result.status.error_code !== 'Success') {
    throw new Error(`Failed to insert document: ${document.metadata.source} ${result.status.error_code}`)
  }

  return result
}

export default DocumentInfo

export const DocHandler = {
  processUploadedDocuments,
  processDocument,
}

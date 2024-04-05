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
var hash = require('object-hash')

const ENABLE_AUTOMATIC_SUMMARIZER = false

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
        const vectorDocumentParts = await prepareDocument(
          doc,
          RUNTIME().VECTOR_DB_DOCUMENT_CHUNK_SIZE,
          RUNTIME().VECTOR_DB_DOCUMENT_CHUNK_OVERLAP,
        )
        const processPromise = processDocumentParts(
          vectorDocumentParts,
          documentInfo,
          chatInfo.chatId,
          collectionName,
          milvusClient,
        )
        // const summaryDocumentParts = await prepareDocument(
        //   doc,
        //   RUNTIME().SUMMARY_DOCUMENT_CHUNK_SIZE,
        //   RUNTIME().SUMMARY_DOCUMENT_CHUNK_OVERLAP,
        // )
        // const summarizePromise = Summarizer.generateSummary(summaryDocumentParts, documentInfo)
        const summary = ENABLE_AUTOMATIC_SUMMARIZER
          ? await generateSummaryForLoadedDocument(doc, documentInfo)
          : undefined
        await Promise.all([processPromise])
        if (!summary && index > 0 && index < documents.length) await sleep(1000) // Wait a little bit for Milvus to avoid errors
        return { documentHash, documentInfo, summary }
      } catch (error) {
        console.log('Error handling document: ', documentInfo, error)
        return { documentHash, documentInfo }
      }
    }),
  )
  //.then((results) => results.filter((result) => result.summary !== undefined))

  milvusClient.closeConnection()

  return processResults
}

const prepareDocument = async (document: Document, chunkSize: number, chunkOverlap: number): Promise<Document[]> => {
  const splitDocumentParts: Document[] = await new RecursiveCharacterTextSplitter({
    chunkSize,
    chunkOverlap,
  }).splitDocuments([document])
  return splitDocumentParts.map(cleanDocument)
}

const cleanDocument = (document: Document) => {
  const cleanedContent = document.pageContent.replaceAll(/\*/gs, ' ').replaceAll(/\s\./g, ' ').replaceAll(/\s+/g, ' ')
  return {
    pageContent: cleanedContent,
    metadata: document.metadata,
  }
}

const getDocumentInfo = (document: Document, chatInfo: ChatInfo): DocumentInfo => {
  const documentSource = SearchUtils.getDocumentSource(document.metadata.source)
  return {
    source: documentSource,
    author: document.metadata.pdf?.info?.Author,
    title: document.metadata.pdf?.info?.Title ?? documentSource,
  }
}

const processDocumentParts = async (
  documentParts: Document[],
  documentInfo: DocumentInfo,
  chatId: string,
  collectionName: string,
  milvusClient: MilvusClient,
) => {
  const embeddings = LLM.getLlmEmbeddings()
  const embeddedDocuments = await embeddings.embedDocuments(documentParts.map((entry) => entry.pageContent))

  const rowData: RowData[] = embeddedDocuments.map((entry, index) => {
    return {
      ...documentInfo,
      chatId,
      pageContent: documentParts[index].pageContent,
      vector: entry,
    }
  })

  const insertReq: InsertReq = { collection_name: collectionName, data: rowData }
  const result = await milvusClient.insert(insertReq)

  if (result.status.error_code !== '' && result.status.error_code !== 'Success') {
    throw new Error(`Failed to insert document: ${documentInfo.source} ${result.status.error_code}`)
  }

  return result
}

const generateSummaryForDocument = async (documentInfo: DocumentInfo): Promise<string | undefined> => {
  const filePath = process.env.NODE_ENV === 'production' ? '/tmp' : 'tmp'
  const documents: Document[] = await new PDFLoader(`${filePath}/${documentInfo.source}`, {
    splitPages: false,
  }).load()
  if (documents.length !== 1) {
    throw new Error(`Failed to load document: ${documentInfo.source}`)
  }
  return generateSummaryForLoadedDocument(documents[0], documentInfo)
}

const generateSummaryForLoadedDocument = async (
  document: Document,
  documentInfo: DocumentInfo,
): Promise<string | undefined> => {
  const summaryDocumentParts = await prepareDocument(
    document,
    RUNTIME().SUMMARY_DOCUMENT_CHUNK_SIZE,
    RUNTIME().SUMMARY_DOCUMENT_CHUNK_OVERLAP,
  )
  const summary = Summarizer.generateSummary(summaryDocumentParts, documentInfo)
  return summary
}

export default DocumentInfo

export const DocHandler = {
  processUploadedDocuments,
  generateSummaryForDocument,
}

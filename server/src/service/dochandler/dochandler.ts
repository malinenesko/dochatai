import { DOCUMENT_TEXT_CHUNK_OVERLAP, DOCUMENT_TEXT_CHUNK_SIZE } from '../../constants'
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { MilvusClientService } from '../vectordb/milvusClient'
import { InsertReq, ResStatus, RowData } from '@zilliz/milvus2-sdk-node'
import { ChatInfo } from '@/src/types'

const handleDocuments = async (chatInfo: ChatInfo, collectionName: string): Promise<boolean> => {
  const filePath = process.env.NODE_ENV === 'production' ? '/tmp' : 'tmp'
  const openAIApiKey = process.env.OPENAI_API_KEY
  console.log('Env variables', process.env.MILVUS_URL, process.env.MILVUS_TOKEN, filePath, openAIApiKey)

  const documents = await new DirectoryLoader(filePath, { '.pdf': (path) => new PDFLoader(path) }).load()
  if (documents.length <= 0) {
    return false
  }
  const splitDocuments = await new RecursiveCharacterTextSplitter({
    chunkSize: Number(DOCUMENT_TEXT_CHUNK_SIZE),
    chunkOverlap: Number(DOCUMENT_TEXT_CHUNK_OVERLAP),
  }).splitDocuments(documents)

  console.log('Split docs: ', splitDocuments.length)

  const embeddings = new OpenAIEmbeddings({ openAIApiKey })
  const embeddedDocuments = await embeddings.embedDocuments(splitDocuments.map((entry) => entry.pageContent))
  console.log('EmbeddedDocs: ', embeddedDocuments.length)

  const rowData: RowData[] = embeddedDocuments.map((entry, index) => {
    return {
      chatName: chatInfo.chatName,
      source: documents[0].metadata.source,
      text: splitDocuments[index].pageContent,
      vector: entry,
    }
  })

  console.log('RowData: ', rowData.length)
  console.log('RowData 0: ', rowData[0])

  const milvusClient = await MilvusClientService.getMilvusClient()
  const upsertReq: InsertReq = { collection_name: collectionName, data: rowData }
  const result = await milvusClient.insert(upsertReq)
  console.log(result)
  // return result.status.code === 0
  return false
}

export const DocHandler = {
  handleDocuments,
}

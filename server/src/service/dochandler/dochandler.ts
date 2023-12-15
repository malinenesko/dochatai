import { DOCUMENT_TEXT_CHUNK_OVERLAP, DOCUMENT_TEXT_CHUNK_SIZE } from '../../constants'
import { DirectoryLoader } from 'langchain/document_loaders/fs/directory'
import { PDFLoader } from 'langchain/document_loaders/fs/pdf'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { MilvusClientService } from '../vectordb/milvusClient'
import { InsertReq, ResStatus, RowData } from '@zilliz/milvus2-sdk-node'

const handleDocuments = async (): Promise<boolean> => {
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

  // console.log('Split docs: ', splitDocuments)

  const embeddings = new OpenAIEmbeddings({ openAIApiKey })
  const embeddedDocuments = await embeddings.embedDocuments(splitDocuments.map((entry) => entry.pageContent))
  // console.log('EmbeddedDocs: ', embeddedDocuments)

  const rowData: RowData[] = embeddedDocuments.map((entry, index) => {
    return {
      chatName: 'dochatai123',
      text: splitDocuments[index].pageContent,
      vector: entry,
    }
  })

  console.log('RowData: ', rowData.length)
  console.log('RowData 0: ', rowData[0])
  // console.log(Object.keys(rowData[0]))

  const milvusClient = await MilvusClientService.getMilvusClient()
  // console.log('Collections: ', await milvusClient.listCollections())
  const collectionSchema = MilvusClientService.getCreateCollectionRequest('dochatai2') //`dochat-collection-${new Date().getTime()}`) // TODO: Generate session name?
  // console.log(collectionSchema)
  const createResult: ResStatus = await milvusClient.createCollection(collectionSchema)
  console.log(createResult)

  // const describeResult = await milvusClient.describeCollection({
  //   collection_name: collectionSchema.collection_name,
  // })
  // console.log(describeResult)

  const upsertReq: InsertReq = { collection_name: collectionSchema.collection_name, data: rowData }
  const result = await milvusClient.insert(upsertReq)
  console.log(result)
  // return result.status.code === 0
  return false
}

export const DocHandler = {
  handleDocuments,
}

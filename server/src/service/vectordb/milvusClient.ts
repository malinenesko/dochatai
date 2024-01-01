import { RUNTIME } from '../../constants'
import {
  CreateColReq,
  CreateCollectionReq,
  MetricType,
  MilvusClient,
  ResStatus,
  ShowCollectionsResponse,
} from '@zilliz/milvus2-sdk-node'
import { error } from 'console'
import { OpenAIEmbeddings } from 'langchain/embeddings/openai'
import { Milvus } from 'langchain/vectorstores/milvus'

// const CALL_TIMEOUT = (process.env.MILVUS_TIMEOUT ?? 30000) as number

const getMilvusClient = (): MilvusClient => {
  const address = process.env.MILVUS_URL ?? ''
  const token = process.env.MILVUS_TOKEN
  return new MilvusClient({ address, token })
}

const getCreateCollectionRequest = (collectionName: string): CreateColReq => {
  const dimension = parseInt(process.env.MILVUS_COLLECTION_DIMENSION ?? '-1')
  console.log('Timeout: ', RUNTIME().CALL_TIMEOUT)
  return {
    collection_name: collectionName,
    dimension,
    // index_file_size: 1024, // optional, default: 1024
    index_params: {
      metric_type: MetricType.IP, // optional, default: "L2"
    },
    description: 'Auto-generated collection by DoChat-Ai',
    vector_field_name: 'vector',
    primary_field_name: 'id',
    auto_id: true,
    // timeout: RUNTIME().CALL_TIMEOUT,
  }
}

const initCollection = async (collectionName: string): Promise<string | undefined> => {
  const milvusClient = getMilvusClient()
  const collectionCreateRequest = getCreateCollectionRequest(collectionName)
  const createResult: ResStatus = await milvusClient.createCollection(collectionCreateRequest)
  const resultOk = createResult.error_code === '' || createResult.error_code === 'Success'
  if (!resultOk) {
    throw new Error(
      `Failed to init collection with name ${collectionName}: ${createResult.error_code} ${createResult.reason}`,
    )
  }

  const descriptionResult = await milvusClient.describeCollection({
    collection_name: collectionName,
    // timeout: RUNTIME().CALL_TIMEOUT, // Causes crash on Milvus
  })

  if (!descriptionResult.collectionID) {
    throw new Error(`Failed to get collection details with name ${collectionName}`)
  }

  console.log('Collection found with ID: ', descriptionResult.collectionID)
  return descriptionResult.collectionID
}

const openClientOnCollection = async (): Promise<Milvus> => {
  const runtime = RUNTIME()
  const milvusClient = await Milvus.fromExistingCollection(new OpenAIEmbeddings(), {
    collectionName: runtime.MILVUS_COLLECTION_NAME,
    textField: 'pageContent',
    vectorField: 'vector',
    clientConfig: {
      address: runtime.MILVUS_URL,
      token: runtime.MILVUS_TOKEN,
    },
  })
  milvusClient.fields.push('chatId', 'source', 'pageContent', 'author', 'title')
  milvusClient.indexCreateParams.metric_type = MetricType.IP
  milvusClient.indexSearchParams = JSON.stringify({ ef: 256 })

  return milvusClient
}

export const MilvusClientService = { getMilvusClient, initCollection, openClientOnCollection }

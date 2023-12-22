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

export const MilvusClientService = { getMilvusClient, initCollection }

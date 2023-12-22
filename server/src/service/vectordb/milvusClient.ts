import {
  CreateColReq,
  CreateCollectionReq,
  MilvusClient,
  ResStatus,
  ShowCollectionsResponse,
} from '@zilliz/milvus2-sdk-node'
import { error } from 'console'

const CALL_TIMEOUT = (process.env.MILVUS_TIMEOUT ?? 30000) as number

const getMilvusClient = async (): Promise<MilvusClient> => {
  const address = process.env.MILVUS_URL ?? ''
  const token = process.env.MILVUS_TOKEN
  return new MilvusClient({ address, token })
}

const getCreateCollectionRequest = (collectionName: string, timeout?: number): CreateColReq => {
  const dimension = parseInt(process.env.MILVUS_COLLECTION_DIMENSION ?? '-1')
  return {
    collection_name: collectionName,
    dimension,
    // index_file_size: 1024, // optional, default: 1024
    // metric_type: 'L2', // optional, default: "L2"
    description: 'Auto-generated collection by DoChat-Ai',
    vector_field_name: 'vector',
    primary_field_name: 'id',
    auto_id: true,
    timeout,
  }
}

const initCollection = async (collectionName: string): Promise<string | undefined> => {
  const milvusClient = await MilvusClientService.getMilvusClient()
  const collectionCreateRequest = getCreateCollectionRequest(collectionName, CALL_TIMEOUT)
  const createResult: ResStatus = await milvusClient.createCollection(collectionCreateRequest)
  const resultOk = createResult.error_code === '' || createResult.error_code === 'Success'
  if (!resultOk) {
    throw new Error(
      `Failed to init collection with name ${collectionName}: ${createResult.error_code} ${createResult.reason}`,
    )
  }

  const descriptionResult = await milvusClient.describeCollection({
    collection_name: collectionName,
    timeout: CALL_TIMEOUT,
  })

  if (!descriptionResult.collectionID) {
    throw new Error(`Failed to get collection details with name ${collectionName}`)
  }

  console.log('Collection found with ID: ', descriptionResult.collectionID)
  return descriptionResult.collectionID
}

export const MilvusClientService = { getMilvusClient, initCollection }

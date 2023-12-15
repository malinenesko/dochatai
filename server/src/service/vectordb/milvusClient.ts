import {
  CreateColReq,
  CreateCollectionReq,
  MilvusClient,
  ResStatus,
  ShowCollectionsResponse,
} from '@zilliz/milvus2-sdk-node'

const CALL_TIMEOUT = (process.env.MILVUS_TIMEOUT ?? 30000) as number

// const connectToMilvus = async (): Promise<ShowCollectionsResponse> => {
//   // Connect to the cluster
//   const client = new MilvusClient({ address, token })
//   return await client.listCollections()
// }

const getMilvusClient = async (): Promise<MilvusClient> => {
  const address = process.env.MILVUS_URL ?? '' // 'https://in03-6e03655cf0329d8.api.gcp-us-west1.zillizcloud.com'
  const token = process.env.MILVUS_TOKEN //'db_6e03655cf0329d8:Lc1<|8F@<*[eQkZN'
  return new MilvusClient({ address, token })
}

const getCreateCollectionRequest = (collection_name: string, timeout?: number): CreateColReq => {
  const dimension = parseInt(process.env.MILVUS_COLLECTION_DIMENSION ?? '-1')
  return {
    collection_name,
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

const initCollection = async (chatName: string): Promise<string | undefined> => {
  const milvusClient = await MilvusClientService.getMilvusClient()
  const collectionCreateRequest = getCreateCollectionRequest(chatName, CALL_TIMEOUT)
  const createResult: ResStatus = await milvusClient.createCollection(collectionCreateRequest)
  console.log(createResult)
  if (createResult.error_code) {
    throw new Error(
      `Failed to init collection with name ${chatName}: ${createResult.error_code} ${createResult.reason}`,
    )
  }

  const descriptionResult = await milvusClient.describeCollection({
    collection_name: 'dochatai2',
    timeout: CALL_TIMEOUT,
  })

  if (!descriptionResult.collectionID) {
    throw new Error(`Failed to get collection details with name ${chatName}`)
  }

  console.log('Collection found with ID: ', descriptionResult.collectionID)
  return descriptionResult.collectionID
}

export const MilvusClientService = { getMilvusClient, getCreateCollectionRequest, initCollection }

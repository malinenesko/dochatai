require('dotenv').config()

export const DOCUMENT_TEXT_CHUNK_SIZE = 512
export const DOCUMENT_TEXT_CHUNK_OVERLAP = 64

export const RUNTIME = () => {
  return {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    CALL_TIMEOUT: (process.env.MILVUS_TIMEOUT ?? 30000) as number,
    MILVUS_URL: process.env.MILVUS_URL ?? '',
    MILVUS_TOKEN: process.env.MILVUS_TOKEN ?? '',
    MILVUS_COLLECTION_NAME: process.env.MILVUS_COLLECTION_NAME ?? 'dochatai',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
    VECTOR_DB_SEARCH_RESULTS_LIMIT: (process.env.VECTOR_DB_SEARCH_RESULTS_LIMIT ?? 5) as number,
  }
}

// export const CALL_TIMEOUT = (process.env.MILVUS_TIMEOUT ?? 30000) as number
// export const MILVUS_URL = process.env.MILVUS_URL ?? ''
// export const MILVUS_TOKEN = process.env.MILVUS_TOKEN ?? ''
// export const MILVUS_COLLECTION_NAME = process.env.MILVUS_COLLECTION_NAME ?? 'dochatai'
// export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? ''

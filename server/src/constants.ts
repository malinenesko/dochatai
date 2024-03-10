require('dotenv').config()

export const RUNTIME = () => {
  return {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    CALL_TIMEOUT: (process.env.MILVUS_TIMEOUT ?? 30000) as number,
    MILVUS_URL: process.env.MILVUS_URL ?? '',
    MILVUS_TOKEN: process.env.MILVUS_TOKEN ?? '',
    MILVUS_COLLECTION_NAME: process.env.MILVUS_COLLECTION_NAME ?? 'dochatai',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
    OPENAI_LLM_MODEL: process.env.OPENAI_LLM_MODEL ?? '',
    VECTOR_DB_DOCUMENT_CHUNK_SIZE: (process.env.VECTOR_DB_DOCUMENT_CHUNK_SIZE ?? 8192) as number,
    VECTOR_DB_DOCUMENT_CHUNK_OVERLAP: (process.env.VECTOR_DB_DOCUMENT_CHUNK_OVERLAP ?? 512) as number,
    VECTOR_DB_SEARCH_RESULTS_LIMIT: (process.env.VECTOR_DB_SEARCH_RESULTS_LIMIT ?? 10) as number,
    SUMMARY_DOCUMENT_CHUNK_SIZE: (process.env.SUMMARY_DOCUMENT_CHUNK_SIZE ?? 8192) as number,
    SUMMARY_DOCUMENT_CHUNK_OVERLAP: (process.env.SUMMARY_DOCUMENT_CHUNK_OVERLAP ?? 512) as number,
    SUMMARY_MAIN_LENGTH: (process.env.SUMMARY_MAIN_LENGTH ?? 100) as number,
    SUMMARY_SUB_LENGTH: (process.env.SUMMARY_SUB_LENGTH ?? 50) as number,
    CHAIN_LOGGING_VERBOSE_MODE: (process.env.CHAIN_LOGGING_VERBOSE_MODE ?? false) as boolean,
  }
}

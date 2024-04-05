require('dotenv').config()

export const RUNTIME = () => {
  return {
    NODE_ENV: process.env.NODE_ENV ?? 'development',
    CALL_TIMEOUT: Number(process.env.MILVUS_TIMEOUT ?? 30000),
    MILVUS_URL: process.env.MILVUS_URL ?? '',
    MILVUS_TOKEN: process.env.MILVUS_TOKEN ?? '',
    MILVUS_COLLECTION_NAME: process.env.MILVUS_COLLECTION_NAME ?? 'dochatai',
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ?? '',
    OPENAI_LLM_MODEL: process.env.OPENAI_LLM_MODEL ?? '',
    LLM_MAX_TOKENS: Number(process.env.LLM_MAX_TOKENS ?? 4096),
    VECTOR_DB_DOCUMENT_CHUNK_SIZE: Number(process.env.VECTOR_DB_DOCUMENT_CHUNK_SIZE ?? 8192),
    VECTOR_DB_DOCUMENT_CHUNK_OVERLAP: Number(process.env.VECTOR_DB_DOCUMENT_CHUNK_OVERLAP ?? 512),
    VECTOR_DB_SEARCH_RESULTS_LIMIT: Number(process.env.VECTOR_DB_SEARCH_RESULTS_LIMIT ?? 10),
    SUMMARY_DOCUMENT_CHUNK_SIZE: Number(process.env.SUMMARY_DOCUMENT_CHUNK_SIZE ?? 8192),
    SUMMARY_DOCUMENT_CHUNK_OVERLAP: Number(process.env.SUMMARY_DOCUMENT_CHUNK_OVERLAP ?? 512),
    SUMMARY_MAIN_LENGTH: Number(process.env.SUMMARY_MAIN_LENGTH ?? 100),
    SUMMARY_SUB_LENGTH: Number(process.env.SUMMARY_SUB_LENGTH ?? 50),
    CHAIN_LOGGING_VERBOSE_MODE: (process.env.CHAIN_LOGGING_VERBOSE_MODE ?? false) as boolean,
  }
}

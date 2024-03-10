import {
  LLMChain,
  MapReduceDocumentsChain,
  RefineDocumentsChain,
  StuffDocumentsChain,
  loadSummarizationChain,
} from 'langchain/chains'
import { LLM } from '../llm'
import { Document } from 'langchain/document'
import { BaseChatModel } from 'langchain/dist/chat_models/base'
import { ChainValues } from 'langchain/dist/schema'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { PromptTemplate } from 'langchain/prompts'
import { RUNTIME } from '../../constants'

let chain: StuffDocumentsChain | MapReduceDocumentsChain | RefineDocumentsChain | undefined

const summaryTemplate = (length: number) => `Write a comprehensive summary of about ${length} words of the following:


"{text}"


COMPREHENSIVE SUMMARY:`

const init = () => {
  if (!chain) {
    const llm = LLM.getLlmModel()
    const mainPrompt = new PromptTemplate({
      template: summaryTemplate(RUNTIME().SUMMARY_MAIN_LENGTH),
      inputVariables: ['text'],
    })
    const subPrompt = new PromptTemplate({
      template: summaryTemplate(RUNTIME().SUMMARY_SUB_LENGTH),
      inputVariables: ['text'],
    })
    chain = loadSummarizationChain(llm, {
      type: 'map_reduce',
      returnIntermediateSteps: true,
      combinePrompt: mainPrompt,
      combineMapPrompt: subPrompt,
    })
  }
  return chain
}

const summarizeMessages = async (documents: Document[]): Promise<ChainValues> => {
  const chain = init()
  const res = await chain.call({
    input_documents: documents,
  })
  return res
}

const generateSummary = async (document: Document) => {
  const splitDocumentParts: Document[] = await new RecursiveCharacterTextSplitter({
    chunkSize: Number(RUNTIME().SUMMARY_DOCUMENT_CHUNK_SIZE),
    chunkOverlap: Number(RUNTIME().SUMMARY_DOCUMENT_CHUNK_OVERLAP),
  }).splitDocuments([document])
  return await Summarizer.summarizeMessages(splitDocumentParts)
}

export const Summarizer = { summarizeMessages, generateSummary }

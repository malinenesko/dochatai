import {
  MapReduceDocumentsChain,
  RefineDocumentsChain,
  StuffDocumentsChain,
  loadSummarizationChain,
} from 'langchain/chains'
import { LLM } from '../llm'
import { Document } from 'langchain/document'
import { AgentAction, AgentFinish, ChainValues } from 'langchain/schema'
import { RecursiveCharacterTextSplitter } from 'langchain/text_splitter'
import { PromptTemplate } from 'langchain/prompts'
import { RUNTIME } from '../../constants'
import { BaseCallbackHandler, CallbackManagerForChainRun, RunCollectorCallbackHandler } from 'langchain/callbacks'
import { Serialized } from 'langchain/load/serializable'
import { sleep } from 'openai/core'

let chain: StuffDocumentsChain | MapReduceDocumentsChain | RefineDocumentsChain | undefined
let chainCounter = 1

class SummarizerCallbackHandler extends BaseCallbackHandler {
  name = 'SummarizerCallbackHandler'

  async handleLLMError(err: any, runId: string, parentRunId?: string | undefined, tags?: string[] | undefined) {
    console.log(`handleLLMError err: ${err}`)
    if (err.code === 'rate_limit_exceeded') {
      let delay = 100000
      try {
        let index = err.message.indexOf('Please try again in ')
        delay = (1000 *
          err.message.substring(index + 'Please try again in '.length, err.message.indexOf('Visit') - 3)) as number
      } catch (error) {
        console.log('Error parsing message: ', error)
      }
      console.log(`handleLLMError err: ${err}, sleeping ${delay}s`)
      await sleep(delay + 1000)
    }
  }

  async handleChainError(
    err: any,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    kwargs?: { inputs?: Record<string, unknown> | undefined } | undefined,
  ) {
    console.log(`handleChainError err: ${err}, sleeping 10s`)
    // await sleep(10000)
  }

  async handleChainStart(chain: Serialized) {
    console.log(`Entering new ${chain.id} chain...`, chainCounter++)
    // await sleep(1000 + chainCounter * 100)
  }

  async handleChainEnd(_output: ChainValues) {
    console.log('Finished chain. ', chainCounter--)
    // await sleep(1000 + chainCounter * 100)
  }

  async handleAgentAction(action: AgentAction) {
    console.log(action.log)
  }

  async handleToolEnd(output: string) {
    console.log(output)
  }

  async handleText(text: string) {
    console.log(text)
  }

  async handleAgentEnd(action: AgentFinish) {
    console.log(action.log)
  }
}

const summaryTemplate = (length: number) => `Write a comprehensive summary of about ${length} words of the following:


"{text}"


COMPREHENSIVE SUMMARY:`

const init = () => {
  if (!chain) {
    const llm = LLM.getLlmModel(1024, 0.1)
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
      verbose: RUNTIME().CHAIN_LOGGING_VERBOSE_MODE,
    })
  }
  return chain
}

const summarizeMessages = async (documents: Document[]): Promise<string> => {
  const chain = init()

  // let contents = documents.map((doc) => doc.pageContent)
  let res = (await processInputs(documents, 10, chain)).map((chainValue) => chainValue.text)
  while (res.length > 1) {
    documents = res.map((text) => ({ pageContent: text } as Document))
    res = (await processInputs(documents, 10, chain)).map((chainValue) => chainValue.text)
  }
  // chain.apply(documents)
  // const callbackHandler = new SummarizerCallbackHandler()
  // const res = await chain.call(
  //   {
  //     input_documents: documents,
  //   },
  //   {
  //     callbacks: [callbackHandler],
  //   },
  // )
  return res[0]
}

const generateSummary = async (document: Document): Promise<string | undefined> => {
  try {
    const splitDocumentParts: Document[] = await new RecursiveCharacterTextSplitter({
      chunkSize: Number(RUNTIME().SUMMARY_DOCUMENT_CHUNK_SIZE),
      chunkOverlap: Number(RUNTIME().SUMMARY_DOCUMENT_CHUNK_OVERLAP),
    }).splitDocuments([document])
    chainCounter = 1
    return await summarizeMessages(splitDocumentParts)
  } catch (error) {
    console.log('Error generating summary for document: ', document.metadata.source, error)
  }
}

async function processInputs(
  inputList: any[],
  userTier: number,
  chain: StuffDocumentsChain | MapReduceDocumentsChain | RefineDocumentsChain,
): Promise<ChainValues[]> {
  try {
    const maxRetries = 6
    const delayIncrement = 60
    const callbackHandler = new SummarizerCallbackHandler()

    // Optimized batch size calculation
    const batchSize = Math.min(10, userTier < 4 ? 50 : 10, inputList.length)
    console.log(`Batch Size: ${batchSize}`)

    let results: any[] = []

    for (let i = 0; i < inputList.length; i += batchSize) {
      const batch = inputList.slice(i, i + batchSize)

      let retries = 0
      while (retries <= maxRetries) {
        try {
          // const result = await chain.apply(batch)
          const result = await chain.call(
            {
              input_documents: batch,
            },
            {
              callbacks: [callbackHandler],
            },
          )
          console.log(`Chain Result: ${result} for Input Batch: ${batch}`)
          results.push(result)
          break // Exit the retry loop once successful
        } catch (rateLimitError) {
          if (rateLimitError instanceof Error) {
            const delay = (retries + 1) * delayIncrement
            console.log(`${rateLimitError}. Retrying in ${delay} seconds...`)
            await sleep(delay * 1000)
            retries += 1

            if (retries > maxRetries) {
              console.error(`Max retries reached for batch starting at index ${i}. Skipping to next batch.`)
              break
            }
          } else {
            throw rateLimitError
          }
        }
      }
    }
    console.log(`Final Results: `, results)
    return results
  } catch (error) {
    console.error(`An error occurred in processInputs: ${error}`)
    return []
  }
}

export const Summarizer = { summarizeMessages, generateSummary }

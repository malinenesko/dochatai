import {
  MapReduceDocumentsChain,
  RefineDocumentsChain,
  StuffDocumentsChain,
  loadSummarizationChain,
} from 'langchain/chains'
import { LLM } from '../llm'
import { Document } from 'langchain/document'
import { AgentAction, AgentFinish, ChainValues } from 'langchain/schema'
import { PromptTemplate } from 'langchain/prompts'
import { RUNTIME } from '../../constants'
import { BaseCallbackHandler } from 'langchain/callbacks'
import { Serialized } from 'langchain/load/serializable'
import { sleep } from 'openai/core'
import DocumentInfo from './dochandler'
import { RateLimitError } from 'openai/error'

let chain: StuffDocumentsChain | MapReduceDocumentsChain | RefineDocumentsChain | undefined
let chainCounter = 1

class SummarizerCallbackHandler extends BaseCallbackHandler {
  name = 'SummarizerCallbackHandler'

  async handleLLMError(err: any, runId: string, parentRunId?: string | undefined, tags?: string[] | undefined) {
    console.log(`handleLLMError err: ${err}`)
  }

  async handleChainError(
    err: any,
    runId: string,
    parentRunId?: string | undefined,
    tags?: string[] | undefined,
    kwargs?: { inputs?: Record<string, unknown> | undefined } | undefined,
  ) {
    console.log(`handleChainError err: ${err}, sleeping 10s`)
  }

  async handleChainStart(chain: Serialized) {
    console.log(`Entering new ${chain.id} chain...`, chainCounter++)
  }

  async handleChainEnd(_output: ChainValues) {
    console.log('Finished chain. ', chainCounter--)
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
`

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

const generateSummary = async (documentParts: Document[], docInfo: DocumentInfo): Promise<string | undefined> => {
  try {
    chainCounter = 1
    return await summarizeMessages(documentParts)
  } catch (error) {
    console.log('Error generating summary for document: ', docInfo.source, error)
  }
}

const summarizeMessages = async (documents: Document[]): Promise<string> => {
  const chain = init()
  let res = (await processInputs(documents, chain)).map((chainValue) => chainValue.text)
  while (res.length > 1) {
    documents = res.map((text) => ({ pageContent: text } as Document))
    res = (await processInputs(documents, chain)).map((chainValue) => chainValue.text)
  }
  return res[0]
}

async function processInputs(
  inputList: any[],
  chain: StuffDocumentsChain | MapReduceDocumentsChain | RefineDocumentsChain,
): Promise<ChainValues[]> {
  try {
    const maxRetries = 6
    const delayIncrement = 60
    const callbackHandler = new SummarizerCallbackHandler()

    const batchSize = Math.min(20, inputList.length)

    let results: any[] = []

    for (let i = 0; i < inputList.length; i += batchSize) {
      const batch = inputList.slice(i, i + batchSize)

      let retries = 0
      while (retries <= maxRetries) {
        try {
          const result = await chain.call(
            {
              input_documents: batch,
            },
            {
              callbacks: [callbackHandler],
            },
          )
          // console.log(`Chain Result: ${result} for Input Batch: ${batch}`)
          results.push(result)
          break
        } catch (chainError) {
          if (chainError instanceof RateLimitError) {
            const delay = (retries + 1) * delayIncrement
            console.log(`${chainError}. SLeep for ${delay} seconds.`)
            await sleep(delay * 1000)
            retries += 1

            if (retries > maxRetries) {
              console.error(`Max retries reached for batch ${i}.`)
              break
            }
          } else {
            console.error(`An error occurred in processInputs: ${chainError}`)
            throw chainError
          }
        }
      }
    }
    return results
  } catch (error) {
    console.error(`Error processing input: ${error}`)
    return []
  }
}

export const Summarizer = { summarizeMessages, generateSummary }

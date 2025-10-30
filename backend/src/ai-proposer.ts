// backend/src/ai-proposer.ts
import { ChatOpenAI } from '@langchain/openai';
import { PromptTemplate } from '@langchain/core/prompts';
import { StructuredOutputParser } from '@langchain/core/output_parsers';
import { z } from 'zod';
import axios from 'axios';
import { sha256 } from 'js-sha256';

// Schema for structured output
const outputParser = StructuredOutputParser.fromZodSchema(
  z.object({
    confidence: z.number().min(0).max(1).describe('Confidence score between 0 and 1'),
    outcome: z.boolean().describe('True/False for binary outcome'),
    summary: z.string().describe('Brief summary of evidence'),
    sources: z.array(z.string()).describe('List of verified sources')
  })
);

const formatInstructions = outputParser.getFormatInstructions();

const promptTemplate = PromptTemplate.fromTemplate(`
You are an AI evidence aggregator for prediction markets. For the event: {eventDescription}

Aggregate evidence from reliable sources like AP News, Reuters, official APIs (e.g., sports APIs, government sites).
Search for corroborating data. Generate a confidence score based on consensus.

{formatInstructions}

Sources to check (simulate real-time fetch):
- News: AP, Reuters
- Blockchain: Solana Explorer if relevant
- Others: Official event sites

Respond only in the specified JSON format.
`);

export interface ProposeResult {
  confidence: number;
  outcome: bool;
  summary: string;
  sources: string[];
  evidenceSummary: string; // For Arweave
}

export async function proposeEvent(eventDescription: string): Promise<ProposeResult> {
  try {
    // Simulate data fetch (in prod, use real APIs)
    const sources = await fetchSources(eventDescription);

    // LLM Chain
    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY,
      modelName: 'gpt-4o-mini', // Efficient for 2025
      temperature: 0.1
    });

    const chain = promptTemplate.pipe(llm).pipe(outputParser);
    const response = await chain.invoke({
      eventDescription,
      formatInstructions
    });

    const result = response as ProposeResult;
    result.evidenceSummary = JSON.stringify({ eventDescription, sources, ...result });

    // Compute hash for on-chain
    // Hash used in evidence-handler

    if (result.confidence < 0.5) {
      throw new Error('Low confidence; flag for human review');
    }

    return result;
  } catch (error) {
    console.error('AI Propose error:', error);
    throw error;
  }
}

async function fetchSources(event: string): Promise<string[]> {
  // Prod: Real API calls
  try {
    const res = await axios.get(`https://newsapi.org/v2/everything?q=${encodeURIComponent(event)}&apiKey=your_newsapi_key`); // Placeholder
    return res.data.articles.map((a: any) => a.source.name);
  } catch {
    // Fallback mock
    return ['AP News', 'Reuters', 'Official API'];
  }
}
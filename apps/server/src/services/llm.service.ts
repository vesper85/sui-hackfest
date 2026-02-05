import OpenAI from "openai";
import { config } from "../config/env";
import type {
    DocumentExtractionResult,
    ProbabilityAssessment,
} from "../types";

class LLMService {
    private openai: OpenAI;

    constructor() {
        this.openai = new OpenAI({
            apiKey: config.openai.apiKey,
        });
    }

    /**
     * Extract structured data from document text
     */
    async extractDocumentData(
        documentText: string,
        documentType: string
    ): Promise<{
        result: DocumentExtractionResult;
        tokensUsed: number;
        cost: number;
    }> {
        const prompt = this.buildExtractionPrompt(documentText, documentType);

        const startTime = Date.now();
        const response = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a financial document analyzer. Extract structured data from documents and return valid JSON only.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.1,
            response_format: { type: "json_object" },
        });

        const latency = Date.now() - startTime;
        const usage = response.usage;
        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error("No response from LLM");
        }

        try {
            const result = JSON.parse(content) as DocumentExtractionResult;

            // Calculate cost (GPT-4o pricing: ~$5/1M input, $15/1M output tokens)
            const inputCost = ((usage?.prompt_tokens || 0) / 1_000_000) * 5;
            const outputCost = ((usage?.completion_tokens || 0) / 1_000_000) * 15;
            const totalCost = inputCost + outputCost;

            return {
                result,
                tokensUsed: (usage?.total_tokens || 0),
                cost: totalCost,
            };
        } catch (error) {
            throw new Error(`Failed to parse LLM response: ${error}`);
        }
    }

    /**
     * Perform probability assessment for risk scoring
     */
    async assessDefaultProbability(
        borrowerProfile: any,
        extractedData: any[]
    ): Promise<{
        result: ProbabilityAssessment;
        tokensUsed: number;
        cost: number;
    }> {
        const prompt = this.buildProbabilityPrompt(borrowerProfile, extractedData);

        const startTime = Date.now();
        const response = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a credit risk analyst. Analyze borrower profiles and assess default probability. Return valid JSON only.",
                },
                {
                    role: "user",
                    content: prompt,
                },
            ],
            temperature: 0.2,
            response_format: { type: "json_object" },
        });

        const usage = response.usage;
        const content = response.choices[0]?.message?.content;

        if (!content) {
            throw new Error("No response from LLM");
        }

        try {
            const result = JSON.parse(content) as ProbabilityAssessment;

            const inputCost = ((usage?.prompt_tokens || 0) / 1_000_000) * 5;
            const outputCost = ((usage?.completion_tokens || 0) / 1_000_000) * 15;
            const totalCost = inputCost + outputCost;

            return {
                result,
                tokensUsed: (usage?.total_tokens || 0),
                cost: totalCost,
            };
        } catch (error) {
            throw new Error(`Failed to parse LLM response: ${error}`);
        }
    }

    /**
     * Build extraction prompt
     */
    private buildExtractionPrompt(
        documentText: string,
        documentType: string
    ): string {
        return `
You are a financial document analyzer. Extract structured data from the following document.

Document Type: ${documentType}
Document Text:
${documentText}

Extract the following information in JSON format:
{
  "documentType": "string",
  "documentDate": "ISO date string or null",
  "accountHolder": "string or null",
  "financialInstitution": "string or null",
  
  "transactions": [
    {
      "date": "ISO date",
      "description": "string",
      "amount": number,
      "balance": number
    }
  ],
  "accountBalance": number,
  "averageMonthlyIncome": number,
  "averageMonthlyExpenses": number,
  
  "assetType": "string",
  "assetValue": number,
  "assetOwner": "string",
  "assetDescription": "string",
  
  "revenue": number,
  "expenses": number,
  "netIncome": number,
  "assets": number,
  "liabilities": number,
  
  "confidence": number (0-1),
  "warnings": ["string"],
  "needsHumanReview": boolean
}

Important:
- Return ONLY valid JSON
- Use null for missing values
- Be conservative with estimates
- Flag ambiguous data in warnings
- Set needsHumanReview to true if document quality is poor or data is unclear
`;
    }

    /**
     * Build probability assessment prompt
     */
    private buildProbabilityPrompt(
        borrowerProfile: any,
        extractedData: any[]
    ): string {
        return `
You are a credit risk analyst. Analyze the borrower's financial profile and assess their probability of default.

Borrower Profile:
${JSON.stringify(borrowerProfile, null, 2)}

Financial Data Extracted:
${JSON.stringify(extractedData, null, 2)}

Analyze the following factors:
1. Income Stability: Is income consistent and verifiable?
2. Expense Management: Are expenses reasonable relative to income?
3. Debt Burden: Is existing debt manageable?
4. Asset Quality: Are assets real and properly valued?
5. Red Flags: Any signs of fraud, financial distress, or inconsistencies?

Provide a risk assessment in JSON format:
{
  "incomeStabilityScore": number (0-100),
  "expenseRatioScore": number (0-100),
  "debtManagementScore": number (0-100),
  "assetQualityScore": number (0-100),
  "overallProbabilityScore": number (0-100),
  
  "defaultProbability": number (0-1),
  "confidenceLevel": "high" | "medium" | "low",
  
  "strengths": ["string"],
  "weaknesses": ["string"],
  "redFlags": ["string"],
  
  "recommendation": {
    "decision": "approve" | "reject" | "review",
    "maxLoanAmount": number,
    "reasoning": "string"
  }
}

Scoring Guide:
- 90-100: Excellent (very low default risk)
- 75-89: Good (low default risk)
- 60-74: Fair (moderate default risk)
- 40-59: Poor (high default risk)
- 0-39: Very Poor (very high default risk)
`;
    }

    /**
     * Generate underwriting report summary
     */
    async generateReportSummary(
        reportData: any
    ): Promise<string> {
        const response = await this.openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a financial analyst. Generate a concise executive summary of an underwriting report.",
                },
                {
                    role: "user",
                    content: `Generate a 2-3 paragraph executive summary of this underwriting report:\n\n${JSON.stringify(reportData, null, 2)}`,
                },
            ],
            temperature: 0.3,
        });

        return response.choices[0]?.message?.content || "";
    }
}

export const llmService = new LLMService();

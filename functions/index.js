import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { OpenAI } from 'openai';
import express from 'express';
import cors from 'cors';

// ✅ Securely fetch OpenAI API Key from Firebase Secrets
const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const app = express();
app.use(cors({ origin: true }));
app.use(express.json());

async function analyzeContractAI(text) {
  const openai = new OpenAI({
    apiKey: OPENAI_API_KEY.value(),
  });

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are a legal contract analysis expert. Analyze the provided contract text and return a JSON object with the following fields:
          
          - "risks": A list of potential risks in the contract with:
            - "location": Clause or section where the issue is found
            - "description": Why it is a risk
            - "rewordedClause": A legally improved alternative
            - "legalAdvice": Why this change is necessary

          - "recommendations": Steps to improve the contract
          - "keyPoints": Important clauses that require attention

          Ensure:
          - Each array contains at least 3 items.
          - The response is strictly JSON without Markdown formatting.
          
          Example:
          {
            "risks": [
              {
                "location": "Clause 5 - Termination",
                "description": "The contract allows unilateral termination by the Provider without notice.",
                "rewordedClause": "Both parties may terminate the agreement with a 30-day written notice.",
                "legalAdvice": "Ensuring mutual termination rights prevents unfair contract enforcement."
              }
            ],
            "recommendations": ["Clarify refund policies", "Specify service deliverables"],
            "keyPoints": ["Confidentiality clause is restrictive", "Indemnity clause shifts full responsibility to the Recipient"]
          }`
        },
        {
          role: "user",
          content: `Analyze this contract and return a structured JSON object with risks, recommendations, and keyPoints.
          
          Contract text: ${text}`
        }
      ],
      response_format: { type: "json_object" }
    });

    let content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error("OpenAI returned an empty response.");
    }

    // ✅ Remove Markdown Formatting if Present
    content = content.replace(/```json|```/g, '').trim();

    const result = JSON.parse(content);

    // Validate response structure
    if (!result.risks || !result.recommendations || !result.keyPoints ||
        !Array.isArray(result.risks) || 
        !Array.isArray(result.recommendations) || 
        !Array.isArray(result.keyPoints)) {
      throw new Error("Invalid response format from OpenAI.");
    }

    return {
      risks: result.risks,
      recommendations: result.recommendations,
      keyPoints: result.keyPoints
    };
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error(`Failed to analyze contract: ${error.message || "Unknown error"}`);
  }
}

// ✅ REST API route for HTTP requests
app.post("/", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) {
      return res.status(400).json({ error: "No contract text provided" });
    }

    const analysis = await analyzeContractAI(text);
    res.status(200).json(analysis);
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: error.message || "Internal Server Error" });
  }
});

// ✅ Export both HTTP and callable Cloud Function
export const analyzeContract = onCall({ secrets: [OPENAI_API_KEY] }, async (request) => {
  const { text } = request.data;
  if (!text) {
    throw new Error('No text provided');
  }
  return await analyzeContractAI(text);
});

// ✅ Export the Express app for HTTP API
export const analyzeContractHttp = onCall({ secrets: [OPENAI_API_KEY] }, app);

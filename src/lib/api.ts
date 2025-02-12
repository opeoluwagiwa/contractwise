import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from './firebase';

const CLOUD_FUNCTION_URL = "https://analyzecontract-ioro5xayua-uc.a.run.app";

interface Risk {
  location: string;
  description: string;
  rewordedClause: string;
  legalAdvice: string;
}

interface AnalysisResponse {
  risks: Risk[];
  recommendations: string[];
  keyPoints: string[];
}

export const analyzeContractText = async (text: string): Promise<AnalysisResponse> => {
  try {
    const response = await fetch(CLOUD_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to analyze contract');
    }

    const data = await response.json();
    
    // Validate response structure
    if (!data || !data.risks || !data.recommendations || !data.keyPoints) {
      throw new Error('Invalid response format from analysis service');
    }

    // Ensure each risk has the required fields
    const validatedRisks = data.risks.map((risk: any) => ({
      location: risk.location || 'Unknown location',
      description: risk.description || 'No description provided',
      rewordedClause: risk.rewordedClause || 'No suggested revision available',
      legalAdvice: risk.legalAdvice || 'No legal advice provided'
    }));

    return {
      risks: validatedRisks,
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      keyPoints: Array.isArray(data.keyPoints) ? data.keyPoints : []
    };
  } catch (error) {
    console.error('Error analyzing contract:', error);
    throw error;
  }
};
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { OpenAI } from 'openai';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: [
    'https://clinquant-mermaid-7ebaaa.netlify.app',
    'http://localhost:5173'
  ],
  methods: ['POST'],
  credentials: true,
  optionsSuccessStatus: 200
}));
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    return req.headers['x-forwarded-for'] || 
           req.headers['x-real-ip'] || 
           req.ip ||
           'unknown';
  },
  skip: (req) => req.method === 'OPTIONS'
});

app.use(limiter);

// Contract Analysis Endpoint
app.post('/api/analyze', async (req, res) => {
  try {
    const { text } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'No text provided' });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "You are a legal contract analysis expert. Analyze the provided contract text and identify key points, potential risks, and recommendations."
        },
        {
          role: "user",
          content: `Please analyze this contract and provide: 
            1. Key points
            2. Potential risks
            3. Recommendations
            Format the response as JSON with these three arrays.
            Contract text: ${text}`
        }
      ],
      response_format: { type: "json_object" }
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    res.json({
      risks: analysis.risks || [],
      recommendations: analysis.recommendations || [],
      keyPoints: analysis.keyPoints || []
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ error: 'Failed to analyze contract' });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
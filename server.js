import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import apiRouter from './routes.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static frontend files
const publicDir = path.join(__dirname, '../public');
app.use(express.static(publicDir));

// API Routes
app.use('/api', apiRouter);

// Fallback for SPA routing to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({
    success: false,
    error: 'Internal server error occurred.'
  });
});

// Start server only when run directly as main script
const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isMain) {
  app.listen(PORT, () => {
    console.log(`=========================================`);
    console.log(`  🇮🇳 Scheme Whisperer is live!`);
    console.log(`  URL: http://localhost:${PORT}`);
    console.log(`  Gemini API: ${process.env.GEMINI_API_KEY ? 'Configured ✅' : 'Heuristic Mode (No API key found)'}`);
    console.log(`=========================================`);
  });
}

export default app;

import express from 'express';
import { loadSchemes } from './matcher.js';
import { matchSchemesWithGemini, draftGrievanceWithGemini } from './gemini.js';

const router = express.Router();

/**
 * Health check endpoint
 */
router.get('/health', (req, res) => {
  const schemes = loadSchemes();
  res.json({
    status: 'ok',
    schemesCount: schemes.length,
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString()
  });
});

/**
 * Get list of all schemes
 */
router.get('/schemes', (req, res) => {
  try {
    const schemes = loadSchemes();
    res.json({ success: true, count: schemes.length, schemes });
  } catch (err) {
    res.status(500).json({ success: false, error: 'Failed to retrieve schemes' });
  }
});

/**
 * Match schemes for a user profile
 */
router.post('/match', async (req, res) => {
  try {
    const profile = req.body || {};

    // Validation
    const age = Number(profile.age);
    if (isNaN(age) || age < 0 || age > 120) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid age between 0 and 120 years.'
      });
    }

    const income = Number(profile.income);
    if (isNaN(income) || income < 0) {
      return res.status(400).json({
        success: false,
        error: 'Please provide a valid annual income (must be 0 or higher).'
      });
    }

    const language = profile.language === 'hi' ? 'hi' : 'en';
    const result = await matchSchemesWithGemini(profile, language);

    // Extract all unique documents required across matched schemes
    const docSet = new Set();
    result.matched.forEach(scheme => {
      (scheme.documents_required || []).forEach(doc => docSet.add(doc.trim()));
    });
    const allUniqueDocuments = Array.from(docSet);

    res.json({
      success: true,
      matchedCount: result.matched.length,
      matched: result.matched,
      nearMisses: result.nearMisses || [],
      uniqueDocuments: allUniqueDocuments,
      source: result.source
    });
  } catch (err) {
    console.error('Error in /api/match:', err);
    res.status(500).json({
      success: false,
      error: 'An error occurred while matching schemes. Please try again.'
    });
  }
});

/**
 * Draft grievance / status-inquiry letter
 */
router.post('/draft-grievance', async (req, res) => {
  try {
    const { schemeId, userSituation, language } = req.body;

    if (!schemeId) {
      return res.status(400).json({
        success: false,
        error: 'schemeId is required.'
      });
    }

    const draft = await draftGrievanceWithGemini(schemeId, userSituation, language || 'en');
    res.json({
      success: true,
      draft
    });
  } catch (err) {
    console.error('Error in /api/draft-grievance:', err);
    res.status(500).json({
      success: false,
      error: err.message || 'Failed to generate grievance draft.'
    });
  }
});

export default router;

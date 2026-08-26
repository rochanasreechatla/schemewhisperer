import { GoogleGenAI } from '@google/genai';
import { loadSchemes, matchSchemesHeuristically, draftGrievanceHeuristically } from './matcher.js';

let aiClient = null;

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  if (!aiClient) {
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

const LANGUAGE_NAMES = {
  en: 'English',
  hi: 'Hindi (हिंदी - Devanagari script)',
  bn: 'Bengali (বাংলা script)',
  ta: 'Tamil (தமிழ் script)',
  te: 'Telugu (తెలుగు script)',
  mr: 'Marathi (मराठी - Devanagari script)',
  kn: 'Kannada (ಕನ್ನಡ script)',
  gu: 'Gujarati (ગુજરાતી script)'
};

/**
 * Match schemes using Gemini API with strict grounding in schemes.json
 */
export async function matchSchemesWithGemini(profile, language = 'en') {
  const schemes = loadSchemes();
  const client = getClient();
  const langName = LANGUAGE_NAMES[language] || 'English';

  if (!client) {
    console.log('No GEMINI_API_KEY found, using heuristic matcher fallback.');
    return matchSchemesHeuristically(profile, schemes);
  }

  const prompt = `You are "Scheme Whisperer", an empathetic, highly knowledgeable civic AI assistant for Indian citizens.
Your task is to analyze the citizen's profile (or family household profile) against the verified database of government welfare schemes and identify the schemes they are genuinely eligible for.

CRITICAL ZERO-HALLUCINATION RULES:
1. ONLY recommend schemes from the verified Grounding Schemes List below. NEVER invent, hallucinate, or alter scheme names or criteria.
2. For each matched scheme, provide a clear, empathetic, 1-to-2 sentence explanation of "why_you_qualify" in plain language.
3. LANGUAGE REQUIREMENT: Output the "why_you_qualify" and "why_not_eligible" text in ${langName}. Write fluent, natural native text in the correct script.
4. If a scheme is a near-miss (e.g. disqualified due to income tax or owning a pucca house), explain the reason in "near_misses".
5. Return ONLY a valid JSON object with the specified structure.

CITIZEN / HOUSEHOLD PROFILE:
- Age: ${profile.age || 'Not specified'}
- Gender: ${profile.gender || 'Not specified'}
- Occupation: ${profile.occupation || 'Not specified'}
- Annual Household Income: ₹${profile.income || 0}
- State / UT: ${profile.state || 'All India'}
- Category: ${profile.category || 'General'}
- Is Landholding Farmer: ${profile.isFarmer ? 'Yes' : 'No'}
- Is Student: ${profile.isStudent ? 'Yes' : 'No'}
- Is Artisan / Traditional Craftsperson: ${profile.isArtisan ? 'Yes' : 'No'}
- Is Street Vendor / Hawker: ${profile.isStreetVendor ? 'Yes' : 'No'}
- Is Business Owner / Starting Greenfield Business: ${profile.isBusiness || profile.isStartingBusiness ? 'Yes' : 'No'}
- Unorganized / Informal Worker: ${profile.isUnorganized ? 'Yes' : 'No'}
- Family owns a pucca house: ${profile.hasPuccaHouse ? 'Yes' : 'No'}
- Family member pays Income Tax: ${profile.isTaxPayer ? 'Yes' : 'No'}
- Has Girl Child under 10 yrs: ${profile.hasGirlChild ? 'Yes' : 'No'}
- Pregnant or Lactating Mother: ${profile.isPregnant ? 'Yes' : 'No'}
- Senior Citizen (70+) in family: ${profile.hasSenior70 ? 'Yes' : 'No'}
- Rooftop with electricity for solar: ${profile.hasSolarRoof ? 'Yes' : 'No'}
- Household Members Overview (if multi-member): ${profile.familyOverview || 'Single citizen evaluation'}
- Target Output Language: ${langName}

GROUNDING SCHEMES LIST (JSON):
${JSON.stringify(schemes, null, 2)}

OUTPUT JSON FORMAT (Strictly match this schema):
{
  "matched": [
    {
      "schemeId": "scheme id from list",
      "why_you_qualify": "1-2 sentence plain language reason in ${langName} why this citizen/household qualifies",
      "priority": "High" | "Medium"
    }
  ],
  "nearMisses": [
    {
      "schemeId": "scheme id from list",
      "why_not_eligible": "1 sentence in ${langName} explaining the specific condition that disqualified them"
    }
  ]
}`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.1
      }
    });

    const responseText = response.text || '';
    const parsed = JSON.parse(responseText);

    // Merge with full scheme metadata from schemes.json to ensure 100% data integrity
    const matchedWithDetails = (parsed.matched || []).map(m => {
      const original = schemes.find(s => s.id === m.schemeId);
      if (!original) return null;
      return {
        schemeId: original.id,
        name: original.name,
        category: original.category,
        short_description: original.short_description,
        benefit_summary: original.benefit_summary,
        why_you_qualify: m.why_you_qualify,
        how_to_apply: original.how_to_apply,
        portal_url: original.portal_url,
        documents_required: original.documents_required,
        processing_notes: original.processing_notes,
        citizen_experience_notes: original.citizen_experience_notes,
        priority: m.priority || 'High'
      };
    }).filter(Boolean);

    const nearMissesWithDetails = (parsed.nearMisses || []).map(nm => {
      const original = schemes.find(s => s.id === nm.schemeId);
      if (!original) return null;
      return {
        schemeId: original.id,
        name: original.name,
        why_not_eligible: nm.why_not_eligible
      };
    }).filter(Boolean);

    return {
      matched: matchedWithDetails,
      nearMisses: nearMissesWithDetails,
      source: 'gemini-3.7-flash'
    };
  } catch (err) {
    console.warn('Gemini API call error in matchSchemes, falling back to heuristic:', err.message);
    return matchSchemesHeuristically(profile, schemes);
  }
}

/**
 * Draft polite, grounded grievance inquiry using Gemini in 8 languages
 */
export async function draftGrievanceWithGemini(schemeId, userSituation = '', language = 'en') {
  const schemes = loadSchemes();
  const scheme = schemes.find(s => s.id === schemeId);

  if (!scheme) {
    throw new Error(`Scheme with id "${schemeId}" not found`);
  }

  const client = getClient();
  const langName = LANGUAGE_NAMES[language] || 'English';

  if (!client) {
    console.log('No GEMINI_API_KEY found, using heuristic grievance drafter.');
    return draftGrievanceHeuristically(scheme, userSituation, language);
  }

  const prompt = `You are "Scheme Whisperer Grievance Drafter", an expert advocate helping an Indian citizen write a polite, highly effective status-inquiry / grievance message for a stalled government welfare application.

CRITICAL INSTRUCTIONS:
1. Ground the message specifically in this scheme's real, documented bottleneck from "processing_notes".
   For example:
   - For PMAY: explicitly reference stage-wise geo-tagged photo verification on AwaasSoft.
   - For PM-KISAN: reference annual biometric/OTP e-KYC status or Aadhaar-bank account DBT mapping.
   - For Ayushman Bharat (PM-JAY): reference hospital empanelment status, SECC 2011 name spelling match, and NHA grievance portal.
   - For PM Surya Ghar: reference DISCOM net-metering approval and inspection upload.
   - For PM Vishwakarma: reference Gram Panchayat / ULB Stage 1 verification.
   - For MGNREGA: reference ABPS payment mapper and 15-day muster roll timeline.
2. Tone: Respectful, clear, professional, constructive, and legally sound.
3. Language: Write the entire letter, spoken script, and action steps in ${langName} in natural native script.
4. Provide 3 distinct outputs:
   a. "formal_letter": A complete formal letter ready to paste into CPGRAMS or the official scheme portal's grievance form.
   b. "spoken_script": A concise 2-sentence script the citizen can say in person to a Common Service Centre (CSC) operator or Panchayat / Bank official.
   c. "actionable_checklist": A list of 3-4 concrete next steps.

SCHEME DETAILS:
- Scheme Name: ${scheme.name}
- Category: ${scheme.category}
- How to Apply / Official Portal: ${scheme.how_to_apply} (${scheme.portal_url || ''})
- Processing Bottleneck Notes: ${scheme.processing_notes || 'Standard document verification and biometric/Aadhaar validation'}
- Citizen's Specific Situation: ${userSituation || 'Application submitted earlier, but payment/status has stalled with no updates.'}

OUTPUT JSON FORMAT (Return strictly valid JSON):
{
  "formal_letter": "string",
  "spoken_script": "string",
  "actionable_checklist": ["step 1", "step 2", "step 3"],
  "bottleneck_focus": "1-line summary of what specific bottleneck is targeted"
}`;

  try {
    const response = await client.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.2
      }
    });

    const parsed = JSON.parse(response.text || '{}');
    return {
      formal_letter: parsed.formal_letter,
      spoken_script: parsed.spoken_script,
      actionable_checklist: parsed.actionable_checklist || [],
      bottleneck_focus: parsed.bottleneck_focus || scheme.processing_notes,
      source: 'gemini-3.7-flash'
    };
  } catch (err) {
    console.warn('Gemini API call error in draftGrievance, falling back to heuristic:', err.message);
    return draftGrievanceHeuristically(scheme, userSituation, language);
  }
}

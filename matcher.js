import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCHEMES_FILE = path.join(__dirname, '../data/schemes.json');

/**
 * Load schemes from JSON file with multi-path fallback for Vercel/Cloud Run/Local
 */
export function loadSchemes() {
  const possiblePaths = [
    path.join(__dirname, '../data/schemes.json'),
    path.join(process.cwd(), 'data/schemes.json'),
    path.join(process.cwd(), 'data', 'schemes.json')
  ];

  for (const p of possiblePaths) {
    try {
      if (fs.existsSync(p)) {
        const raw = fs.readFileSync(p, 'utf-8');
        return JSON.parse(raw);
      }
    } catch (e) {
      // Continue to next path
    }
  }

  console.error('Error loading schemes.json: File not found in possible paths');
  return [];
}

/**
 * Heuristic/Rule-Based scheme matching fallback
 * Evaluates citizen eligibility deterministically against schemes.json
 */
export function matchSchemesHeuristically(profile, schemes = loadSchemes()) {
  const age = Number(profile.age) || 0;
  const income = Number(profile.income) || 0;
  const gender = (profile.gender || 'any').toLowerCase();
  const occupation = (profile.occupation || '').toLowerCase();
  const isFarmer = Boolean(profile.isFarmer || occupation.includes('farmer') || profile.hasLand);
  const isStudent = Boolean(profile.isStudent || occupation.includes('student'));
  const isBusiness = Boolean(profile.isBusiness || occupation.includes('business') || occupation.includes('entrepreneur') || profile.isStartingBusiness);
  const isArtisan = Boolean(profile.isArtisan || occupation.includes('artisan') || occupation.includes('carpenter') || occupation.includes('blacksmith') || occupation.includes('potter') || occupation.includes('craft'));
  const isStreetVendor = Boolean(profile.isStreetVendor || occupation.includes('vendor') || occupation.includes('hawker') || occupation.includes('thela'));
  const isUnorganized = Boolean(profile.isUnorganized || isArtisan || isStreetVendor || occupation.includes('unorganized') || occupation.includes('daily') || occupation.includes('wage'));
  const isTaxPayer = Boolean(profile.isTaxPayer);
  const hasPuccaHouse = Boolean(profile.hasPuccaHouse);
  const isWoman = gender === 'female' || gender === 'woman';
  const category = (profile.category || 'General').toUpperCase();
  const isReservedCategory = ['SC', 'ST', 'OBC', 'EWS', 'MINORITY'].includes(category);
  const hasGirlChild = Boolean(profile.hasGirlChild);
  const isPregnant = Boolean(profile.isPregnant);
  const hasSenior70 = Boolean(profile.hasSenior70 || age >= 70);
  const hasSolarRoof = Boolean(profile.hasSolarRoof || profile.hasElectricityConnection);

  const matched = [];
  const nearMisses = [];

  for (const scheme of schemes) {
    let eligible = false;
    let reason = '';
    let nearMissReason = '';

    switch (scheme.id) {
      case 'pm-kisan':
        if (isFarmer && !isTaxPayer) {
          eligible = true;
          reason = 'You are a landholding farmer and non-income tax payer, qualifying for direct DBT income support of ₹6,000/yr.';
        } else if (isFarmer && isTaxPayer) {
          nearMissReason = 'Income tax paying families are excluded from PM-KISAN.';
        }
        break;

      case 'ayushman-bharat-pmjay':
        if (hasSenior70) {
          eligible = true;
          reason = 'Senior citizens aged 70+ are universally covered under PM-JAY without income caps for ₹5 Lakh hospitalization.';
        } else if (income <= 300000 || isUnorganized || isReservedCategory) {
          eligible = true;
          reason = 'Your household profile falls within the priority deprivation criteria for ₹5 Lakh/yr cashless hospitalization.';
        }
        break;

      case 'pmay':
        if (!hasPuccaHouse && income <= 900000) {
          eligible = true;
          const band = income <= 300000 ? 'EWS' : income <= 600000 ? 'LIG' : 'MIG';
          reason = `Eligible under the ${band} category since your family does not own a pucca house and income is within ₹9 Lakh.`;
        } else if (hasPuccaHouse) {
          nearMissReason = 'Household already owns a pucca house.';
        }
        break;

      case 'pm-surya-ghar':
        if (hasSolarRoof || income <= 800000 || age >= 18) {
          eligible = true;
          reason = 'Eligible as a household with rooftop and electricity connection for central solar subsidy up to ₹78,000 and 300 free power units/month.';
        }
        break;

      case 'pm-vishwakarma':
        if ((isArtisan || isUnorganized) && age >= 18) {
          eligible = true;
          reason = 'Eligible as a traditional craftsperson/artisan for ₹15,000 toolkit voucher, training stipend, and 5% interest loans up to ₹3 Lakh.';
        }
        break;

      case 'pm-svanidhi':
        if (isStreetVendor || isUnorganized) {
          eligible = true;
          reason = 'Eligible as an urban/semi-urban street vendor for collateral-free working capital loans from ₹10,000 up to ₹50,000 with 7% interest subsidy.';
        }
        break;

      case 'mgnrega':
        if (age >= 18 && (isUnorganized || income <= 300000 || profile.isRural)) {
          eligible = true;
          reason = 'Eligible for 100 days of guaranteed wage employment per year for adult members willing to do manual work.';
        }
        break;

      case 'pmmvy':
        if (isPregnant || (isWoman && age >= 19 && age <= 45 && hasGirlChild)) {
          eligible = true;
          reason = 'Eligible as a pregnant/lactating mother for direct DBT cash benefit of ₹5,000–₹6,000.';
        }
        break;

      case 'pm-jan-dhan':
        if (age >= 10) {
          eligible = true;
          reason = 'Universally eligible for a zero-balance BSBD bank account with free RuPay debit card and ₹2 Lakh accident insurance.';
        }
        break;

      case 'pm-ujjwala':
        if (isWoman && income <= 250000) {
          eligible = true;
          reason = 'Eligible as an adult woman from a low-income household for a free LPG connection, deposit waiver, and first refill.';
        } else if (!isWoman) {
          nearMissReason = 'PMUY connections are issued in the name of an adult woman in the family.';
        }
        break;

      case 'sukanya-samriddhi':
        if (hasGirlChild || (isWoman && age <= 10)) {
          eligible = true;
          reason = 'Eligible for high-interest tax-exempt savings for a girl child under age 10.';
        }
        break;

      case 'atal-pension-yojana':
        if (age >= 18 && age <= 40 && !isTaxPayer) {
          eligible = true;
          reason = `At age ${age} (between 18–40) and as a non-taxpayer, you can subscribe for a guaranteed monthly pension of ₹1,000–₹5,000.`;
        } else if (age > 40) {
          nearMissReason = 'Atal Pension Yojana entry age is capped at 40 years.';
        }
        break;

      case 'pmjjby':
        if (age >= 18 && age <= 50) {
          eligible = true;
          reason = `At age ${age} (18–50), you qualify for ₹2 Lakh life insurance cover for ₹436/year auto-debited via bank.`;
        }
        break;

      case 'pmsby':
        if (age >= 18 && age <= 70) {
          eligible = true;
          reason = `At age ${age} (18–70), you qualify for ₹2 Lakh accidental death/disability cover for ₹20/year.`;
        }
        break;

      case 'pm-mudra-yojana':
        if (isBusiness || profile.isStartingBusiness || age >= 18) {
          eligible = true;
          reason = 'Eligible for collateral-free business loans from ₹50,000 up to ₹20 Lakh (Shishu/Kishor/Tarun) for non-farm enterprises.';
        }
        break;

      case 'stand-up-india':
        if ((isWoman || ['SC', 'ST'].includes(category)) && (isBusiness || profile.isStartingBusiness) && age >= 18) {
          eligible = true;
          reason = 'Eligible as an SC/ST or woman entrepreneur setting up a new greenfield enterprise for bank loans up to ₹1 Crore.';
        } else if (profile.isStartingBusiness && !isWoman && !['SC', 'ST'].includes(category)) {
          nearMissReason = 'Targeted specifically for SC/ST and Women entrepreneurs.';
        }
        break;

      case 'national-scholarship-portal':
        if (isStudent && income <= 250000 && isReservedCategory) {
          eligible = true;
          reason = 'Eligible as an enrolled student from SC/ST/OBC/Minority/EWS category with annual income under ₹2.5 Lakh.';
        } else if (isStudent && income > 250000) {
          nearMissReason = 'Family income exceeds the ₹2.5 Lakh threshold for standard pre/post-matric scholarships.';
        }
        break;

      case 'pm-shram-yogi-maandhan':
        if (age >= 18 && age <= 40 && income <= 180000 && (isUnorganized || !isTaxPayer)) {
          eligible = true;
          reason = 'Eligible as an unorganized sector worker with monthly income ≤ ₹15,000 for 50% government-matched pension.';
        } else if (income > 180000) {
          nearMissReason = 'Income exceeds the ₹15,000/month threshold for PM-SYM.';
        }
        break;

      default:
        break;
    }

    if (eligible) {
      matched.push({
        schemeId: scheme.id,
        name: scheme.name,
        category: scheme.category,
        short_description: scheme.short_description,
        benefit_summary: scheme.benefit_summary,
        why_you_qualify: reason,
        how_to_apply: scheme.how_to_apply,
        portal_url: scheme.portal_url,
        documents_required: scheme.documents_required,
        processing_notes: scheme.processing_notes,
        citizen_experience_notes: scheme.citizen_experience_notes
      });
    } else if (nearMissReason) {
      nearMisses.push({
        schemeId: scheme.id,
        name: scheme.name,
        why_not_eligible: nearMissReason
      });
    }
  }

  return { matched, nearMisses, source: 'heuristic' };
}

/**
 * Generate heuristic fallback grievance inquiry draft grounded in processing notes for 8 languages
 */
export function draftGrievanceHeuristically(scheme, userSituation = '', language = 'en') {
  const schemeName = scheme.name;
  const processingNotes = scheme.processing_notes || '';

  // Multilingual templates
  if (language === 'hi') {
    return {
      formal_letter: `सेवा में,\nसंबंधित नोडल अधिकारी / शिकायत निवारण प्रकोष्ठ,\nयोजना: ${schemeName}\n\nविषय: ${schemeName} के तहत आवेदन / किस्त स्थिति के संबंध में पूछताछ\n\nमहोदय/महोदया,\n\nमैंने ${schemeName} योजना के लिए आवश्यक दस्तावेजों के साथ आवेदन किया था। आवेदन के बाद से मेरी स्थिति लंबित प्रदर्शित हो रही है। ${userSituation ? `मेरी वर्तमान स्थिति: ${userSituation}। ` : ''}\n\nकृपया मेरी फाइल की जांच करें और मुझे अवगत कराएं कि क्या कोई e-KYC, बैंक खाता सीडिंग, या फील्ड/जियो-टैग सत्यापन अधूरा है (${processingNotes})।\n\nमैं योजना के सभी पात्रता मानदंडों को पूरा करता/करती हूँ। कृपया लंबित प्रक्रिया को शीघ्र पूरा करने में मार्गदर्शन करें।\n\nधन्यवाद,\nआवेदक`,
      spoken_script: `नमस्ते सर/मैडम, मैंने ${schemeName} के लिए आवेदन किया था लेकिन भुगतान/स्थिति रुकी हुई है। कृपया जांच कर बताएं कि क्या कोई बायोमेट्रिक e-KYC या दस्तावेज़ सत्यापन लंबित है?`,
      actionable_checklist: [
        'अपने आधार से जुड़े मोबाइल नंबर पर OTP की जांच करें',
        'बैंक खाते में आधार NPCI DBT मैपिंग (Aadhaar Seeding) सत्यापित करें',
        'निकटतम CSC केंद्र या संबंधित पोर्टल पर "Know Your Status" में आवेदन संख्या दर्ज करें'
      ],
      bottleneck_focus: processingNotes
    };
  }

  if (language === 'bn') {
    return {
      formal_letter: `বরাবর,\nঅভিযোগ প্রতিকার কর্মকর্তা / প্রকল্প নোডাল অফিসার,\nপ্রকল্প: ${schemeName}\n\nবিষয়: ${schemeName} প্রকল্পের আওতায় আবেদন / কিস্তির স্থিতি সম্পর্কিত অনুসন্ধান\n\nমহাশয়/মহাশয়া,\n\nআমি ${schemeName} প্রকল্পের জন্য আবেদন করেছি। তবে বর্তমান অবস্থা স্থগিত রয়েছে। ${userSituation ? `আমার বর্তমান পরিস্থিতি: ${userSituation}। ` : ''}\n\nদয়া করে আমার ফাইলটি পরীক্ষা করুন এবং কোনো e-KYC বা ফিল্ড ভেরিফিকেশন বকেয়া রয়েছে কি না তা জানান (${processingNotes})।\n\nধন্যবাদ,\nআবেদনকারী`,
      spoken_script: `নমস্কার, আমি ${schemeName} প্রকল্পে আবেদন করেছিলাম কিন্তু স্ট্যাটাস আটকে আছে। দয়া করে চেক করে জানাবেন কোনো ভেরিফিকেশন বাকি আছে কি?`,
      actionable_checklist: [
        'আধার লিঙ্কযুক্ত মোবাইলে মেসেজ চেক করুন',
        'ব্যাংক অ্যাকাউন্টে NPCI DBT ম্যাপিং যাচাই করুন',
        'নিকটস্থ CSC সেন্টারে স্ট্যাটাস চেক করুন'
      ],
      bottleneck_focus: processingNotes
    };
  }

  if (language === 'ta') {
    return {
      formal_letter: `பெறுநர்,\nதிட்ட நோடல் அதிகாரி / குறைதீர்க்கும் அலுவலர்,\nதிட்டம்: ${schemeName}\n\nபொருள்: ${schemeName} திட்ட விண்ணப்ப நிலை குறித்த விசாரணை\n\nமதிப்பிற்குரிய ஐயா/அம்மா,\n\nநான் ${schemeName} திட்டத்திற்கு விண்ணப்பித்துள்ளேன். ஆனால் நிலை இன்னும் நிலுவையில் உள்ளது. ${userSituation ? `விவரம்: ${userSituation}. ` : ''}\n\nதயவுசெய்து எனது கோப்பைச் சரிபார்த்து, e-KYC அல்லது சரிபார்ப்பு நிலுவையில் உள்ளதா எனத் தெரிவிக்கவும் (${processingNotes}).\n\nநன்றி,\nவிண்ணப்பதாரர்`,
      spoken_script: `வணக்கம், நான் ${schemeName} திட்டத்திற்கு விண்ணப்பித்திருந்தேன். எனது விண்ணப்ப நிலை மற்றும் சரிபார்ப்பு பற்றி சரிபார்த்து உதவ முடியுமா?`,
      actionable_checklist: [
        'ஆதார் இணைக்கப்பட்ட மொபைலில் OTP சரிபார்க்கவும்',
        'வங்கி கணக்கில் DBT இணைப்பை சரிபார்க்கவும்',
        'அருகிலுள்ள CSC மையத்தில் நிலையை சரிபார்க்கவும்'
      ],
      bottleneck_focus: processingNotes
    };
  }

  if (language === 'te') {
    return {
      formal_letter: `గౌరవనీయులైన నోడల్ అధికారి గారికి,\nపథకం: ${schemeName}\n\nవిషయం: ${schemeName} దరఖాస్తు స్థితి గురించి విచారణ\n\nఅయ్యా/అమ్మా,\n\nనేను ${schemeName} పథకానికి దరఖాస్తు చేసుకున్నాను. ప్రస్తుతం దరఖాస్తు పెండింగ్‌లో ఉంది. ${userSituation ? `పరిస్థితి: ${userSituation}. ` : ''}\n\nదయచేసి నా దరఖాస్తును తనిఖీ చేసి, e-KYC లేదా ధృవీకరణ పెండింగ్‌లో ఉందో లేదో తెలియజేయగలరు (${processingNotes}).\n\nధన్యవాదాలు,\nదరఖాస్తుదారు`,
      spoken_script: `నమస్కారం, నేను ${schemeName} కోసం దరఖాస్తు చేశాను కానీ స్థితి ఆగిపోయింది. దయచేసి పరిశీలించి సహాయం చేయండి.`,
      actionable_checklist: [
        'ఆధార్ లింక్ అయిన మొబైల్‌లో OTP తనిఖీ చేయండి',
        'బ్యాంక్ ఖాతాలో NPCI DBT లింకేజ్ నిర్ధారించండి',
        'సమీప CSC కేంద్రాన్ని సంప్రదించండి'
      ],
      bottleneck_focus: processingNotes
    };
  }

  return {
    formal_letter: `To,\nThe Public Grievance Officer / Scheme Nodal Officer,\nScheme: ${schemeName}\n\nSubject: Status Inquiry and Grievance regarding pending application / disbursement under ${schemeName}\n\nRespected Sir/Madam,\n\nI have applied for benefits under ${schemeName} with all required documentation. However, I have not received any confirmation or the disbursement is currently stalled. ${userSituation ? `Details of my situation: ${userSituation}. ` : ''}\n\nAs per standard guidelines, please verify if there is any pending verification bottleneck, such as:\n• Specific processing checkpoint: ${processingNotes}\n• Aadhaar-Bank account DBT mapping or annual eKYC status.\n\nI meet all the required eligibility conditions and request your urgent assistance in resolving this delay.\n\nThanking you,\nYours sincerely,\nApplicant`,
    spoken_script: `Hello Officer, I had applied for ${schemeName} and my application is currently delayed. Could you please check on the portal if my e-KYC, Aadhaar bank seeding, or field inspection is pending on my application number?`,
    actionable_checklist: [
      'Check "Know Your Status" on the official portal using your Registration Number',
      'Verify that Aadhaar is properly linked to your bank account with NPCI DBT mapper enabled',
      'Visit your nearest Common Service Centre (CSC) or Panchayat office with Aadhaar and passbook'
    ],
    bottleneck_focus: processingNotes
  };
}

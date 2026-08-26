# Scheme Whisperer — Build Guide for PromptWars

**Theme:** AI for Open Innovation
**Goal:** A simple web app where a user enters basic details and gets back the real government welfare schemes they're likely eligible for, explained in plain language — and unlike existing scheme-matcher apps, it also helps them prepare to apply and get unstuck if something goes wrong afterward.

## What makes this different from existing apps (myScheme, YojanaSahay, SchemeAtlas, etc.)

Every competitor checked stops at "here's a list, here's a link." Scheme Whisperer covers the two things they all skip:

1. **Document Readiness Checklist** — after matching, shows exactly which documents the user likely already has vs. still needs per scheme, based on what they entered in the form
2. **Post-Application Grievance Drafter** — a button ("I applied but haven't heard back") that drafts a polite status-inquiry/grievance message, grounded in that scheme's real documented bottleneck (e.g., for PMAY: ask specifically about pending geo-tag verification, since that's the most common real cause of delay)

**Pitch line for your submission/demo:** *"Existing apps tell you what you qualify for. Scheme Whisperer helps you actually get it — from knowing what to bring, to knowing what to say when your application stalls."*

**Stretch goals if time remains:** household/family profile matching (multiple people, not just one), and "why you didn't qualify" transparency for near-misses. Not required for a working submission — add only if the core flow is solid and tested with time to spare.

---

## Why this scores well

| Judging criterion | How this app addresses it |
|---|---|
| Problem-statement alignment | Directly solves a real, common problem: people not knowing/claiming benefits they qualify for |
| Social impact | Scales to anyone — rural, urban, any income group |
| Accessibility | Plain-language output, no jargon, works on any device via browser |
| Security | No login, no personal data stored — nothing to leak |
| Code quality / testing | Small, single-purpose app is easy to keep clean and test end-to-end |
| Google services usage | Gemini API for reasoning/explanation + Cloud Run for deployment |

---

## Step 0: Before the event (do this at home per the deck's instructions)

1. Install Antigravity from antigravity.google
2. Sign in with your Google account
3. Create a project folder, e.g. `scheme-whisperer`
4. Open it as a workspace in Antigravity

---

## Step 1: The data file

Use `schemes-detailed.json` — 12 real, verified Indian government schemes, now expanded with `documents_required`, `processing_notes`, and a `citizen_experience_notes` field. Save it into your project folder as `data/schemes.json`. This is your app's factual grounding — the AI should only recommend from this list, not hallucinate scheme details.

**About `citizen_experience_notes`:** For the schemes with the most public reporting (PM-KISAN, Ayushman Bharat, PMAY), this field contains real, researched summaries of documented citizen experiences — a balanced mix of what tends to go well and common friction points (delays, verification issues, documentation gaps), paraphrased from news coverage and a hospital-based patient satisfaction study, not fabricated. The remaining schemes have this field set to `null` since I didn't find enough substantive, verifiable reporting to summarize responsibly — better to leave it empty than make something up.

If you want to display this in the UI, frame it honestly, e.g. a "What other applicants have experienced" section with a small disclaimer like *"Based on publicly reported cases — your experience may vary."* Don't present it as a star rating or review count; it's qualitative context, not a verified review system.

---

## Step 2: Prompt sequence for Antigravity (use Planning Mode: Cmd/Ctrl + L)

### Prompt 1 — Planning
```
I'm building a web app called "Scheme Whisperer" for a hackathon focused on AI for Open Innovation / social impact.

Core flow: A user fills a short form (age, occupation, approximate annual income, state, and whether they're a farmer/student/woman/senior citizen/business owner — checkboxes), and the app returns which government welfare schemes from my schemes.json file they are likely eligible for, explained in simple, plain language with a one-line "why you qualify" and a link/instruction on how to apply.

Each scheme in my data file also has: documents_required, processing_notes, and citizen_experience_notes (which may be null).

Feature 1 — Document Readiness Checklist: For each matched scheme, show documents_required as a checklist. Ask the user a simple follow-up (checkboxes: "Do you have: Aadhaar card / Bank account / Income certificate / [etc, deduplicated across matched schemes]") and mark each document per scheme as ✅ likely have it or ⚠️ may need to arrange it, based on their answers.

Feature 2 — Post-Application Grievance Drafter: On each matched scheme's card, add a button: "Applied but haven't heard back?" When clicked, it opens a small text area for the user to briefly describe their situation (optional), then calls Gemini to draft a polite, simple status-inquiry/grievance message. Ground this in that scheme's processing_notes field — e.g. for PMAY, the draft should specifically suggest asking about geo-tag/field verification status, since that's the documented common bottleneck. The message should be something the user could plausibly say at a CSC, panchayat office, or on a grievance portal.

If citizen_experience_notes is present for a scheme, show it under a clearly labeled section like "What other applicants have experienced" with a small disclaimer that it's based on publicly reported cases, not a verified review system. If it's null, don't show that section for that scheme at all.

Requirements:
- Simple, clean, mobile-friendly single-page web app
- Use a small Node.js/Express or Python/Flask backend that reads schemes.json
- Call the Gemini API to do the matching, document-checklist reasoning, grievance drafting, and plain-language explanations (not hardcoded if/else) — pass the user's inputs and the schemes.json content into the prompt, and instruct Gemini to only recommend schemes from the provided list, never invent new ones or fabricate procedural advice not grounded in processing_notes
- Add a simple English/Hindi toggle for the output text (Gemini can handle the translation)
- No login, no database, no personal data storage — stateless
- Include basic accessibility: proper labels on form fields, decent color contrast, readable font sizes
- Structure it so it can be deployed to Cloud Run

Please create a plan first before writing code.
```

### Prompt 2 — After reviewing the plan
```
This plan looks good. Please proceed and build it. Use environment variables for the Gemini API key (don't hardcode it). Add basic input validation on the form (e.g., income must be a number, age must be reasonable). Include a simple loading state while the API call is in progress, and a friendly error message if the API call fails.
```

### Prompt 3 — Testing
```
Now write a few basic tests: one that confirms the schemes.json loads correctly, one that confirms the API endpoint returns a valid response structure for a sample input, and one that checks the app handles a missing/invalid API key gracefully. Keep the tests simple and fast to run.
```

### Prompt 4 — Deployment
```
Help me prepare this app for deployment to Google Cloud Run. Generate a Dockerfile, explain the exact gcloud commands I need to run to deploy it, and tell me how to set the Gemini API key as a Cloud Run environment variable/secret rather than committing it to the repo.
```

### Prompt 5 — Polish (if time remains)
```
Improve the visual design — use a clean, modern layout with good spacing, a clear call-to-action button, and a results section that displays each matched scheme as a card with the scheme name, why the user qualifies, benefit summary, and how to apply. Keep it simple, don't over-engineer.
```

---

## Step 3: Before submitting — checklist

- [ ] Repo is public on GitHub
- [ ] `.env` / API keys are in `.gitignore`, NOT committed
- [ ] Deployed Cloud Run link works when opened in an incognito window (test this — DQ risk if broken)
- [ ] App doesn't crash on empty/weird form input
- [ ] README explains what the app does and how to run it locally

---

## Step 4: Project description (for submission form)

Use or adapt this:

> **Scheme Whisperer** helps people discover government welfare schemes they're actually eligible for — and unlike existing scheme-matcher tools, it doesn't stop at "here's a list." Millions of eligible citizens miss out on benefits like PM-KISAN, Ayushman Bharat, or PM Awas Yojana simply because they don't know these schemes exist, don't understand the eligibility criteria, or get stuck somewhere in the application process. Users enter a few basic details and the app uses Gemini to match them against a curated database of real government schemes, explaining in simple language why they qualify. It then generates a personalized document readiness checklist so they know exactly what to bring, and — the feature no other scheme app offers — a one-click grievance/status-inquiry drafter that helps users follow up when an application stalls, grounded in real, researched patterns of where each scheme's process typically breaks down. Built with a Node.js backend, deployed on Cloud Run, with no login or data storage required.

---

## Notes / things to watch out for

- **Don't let the AI hallucinate scheme details.** Always ground it in your `schemes.json` — this is both more accurate and scores better on "problem-statement alignment."
- **Keep scope tight.** A working 12-scheme matcher beats a broken 100-scheme one. You can always expand the JSON later if time allows.
- **Test the deployed link 20 minutes before evaluation**, not right when the build phase ends — leave buffer in case Cloud Run needs a redeploy.

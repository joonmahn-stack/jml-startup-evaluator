# JML Startup Evaluator — API Version

This is the first real API-connected version of the JML Startup Evaluation site.

## What works
- Stage 1: text answers -> OpenAI evaluation
- Stage 2: text answers -> OpenAI evaluation
- Stage 3: PDF upload -> OpenAI reads the final deck and returns a VC-style evaluation
- API key stays on the server; students never see it
- Default model: `gpt-5.6-terra`
- Uploaded Stage 3 PDFs are configured to expire and are also deleted after evaluation when possible

## 1. Create an OpenAI API account and add billing
Go to the OpenAI API Platform, open Billing, add a payment method / prepaid credits.

ChatGPT Plus and API billing are separate.

## 2. Create an API key
Create a secret key in the OpenAI API Platform.

IMPORTANT: Do NOT paste your secret key into ChatGPT, email, a webpage, or `public/index.html`.

## 3. Put the key in `.env`
Copy `.env.example` to a new file called `.env`.

Edit:
OPENAI_API_KEY=your_real_secret_key
OPENAI_MODEL=gpt-5.6-terra
PORT=3000

Never upload `.env` publicly.

## 4. Install Node.js
Use Node.js 20 or newer.

## 5. Install and run locally
In this folder:

npm install
npm start

Then open:
http://localhost:3000

## 6. Test before deployment
Try:
- one Stage 1 idea
- one Stage 2 idea
- one PDF final deck

The page should show real JML evaluations rather than sample outputs.

## 7. Deployment recommendation
For a first classroom version, deploy the entire Node app to a service that supports:
- Node.js
- environment variables
- multipart file uploads

Examples include Render, Railway, Fly.io, or a comparable Node hosting service.

Set `OPENAI_API_KEY` as a private environment variable in the host dashboard.
Do not put it in GitHub or client-side JavaScript.

## 8. Stage 3 file policy
Version 1 intentionally accepts PDF only.
Ask students to export PowerPoint/Keynote/Google Slides to PDF before uploading.
This is simpler and more reliable.

## 9. Cost control recommendations
- Start with `gpt-5.6-terra`.
- Set a modest prepaid balance / recharge limit.
- Monitor the API Usage Dashboard during the first class.
- Do not use GPT-6 Astra for routine evaluation unless you later find Terra insufficient.
- Keep results concise.

## 10. Before sharing with the whole class
Recommended:
1. Test 5–10 historical/sample ideas.
2. Compare AI grades with Professor Lee's own grades.
3. Adjust prompt thresholds if A/B/C/D is too generous or harsh.
4. Only then send the public URL to students.

## Security
The browser sends student responses to your own server.
Your server calls OpenAI using `OPENAI_API_KEY`.
This is why the API key must never be placed inside the HTML/JavaScript sent to students.


## v1.1 — More generous classroom grading
This version intentionally makes numerical grades somewhat more generous while keeping qualitative comments critical.

Suggested interpretation:
- Stage 1: A 82+, B 68+
- Stage 2: A 88+, B 73+
- Stage 3: A 88+, B 73+

Stage 3's academic grade can be higher than the separate INVEST / WATCH / PASS decision.

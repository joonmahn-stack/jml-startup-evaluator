import express from "express";
import multer from "multer";
import dotenv from "dotenv";
import OpenAI, { toFile } from "openai";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config();

if (!process.env.OPENAI_API_KEY) {
  console.warn("OPENAI_API_KEY is not set. Add it to .env before evaluating.");
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const MODEL = process.env.OPENAI_MODEL || "gpt-5.6-terra";
const app = express();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
});

app.use(express.json({ limit: "1mb" }));

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
app.use(express.static(path.join(__dirname, "public")));

const stage1Schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    grade: { type: "string", enum: ["A","B","C","D"] },
    score: { type: "integer", minimum: 0, maximum: 100 },
    verdict: { type: "string" },
    problem: { type: "integer", minimum: 0, maximum: 10 },
    pain: { type: "integer", minimum: 0, maximum: 10 },
    solution_logic: { type: "integer", minimum: 0, maximum: 10 },
    market: { type: "integer", minimum: 0, maximum: 10 },
    scale_test: { type: "string", enum: ["PLAUSIBLE","POSSIBLE, BUT UNCLEAR","UNLIKELY"] },
    next_question: { type: "string" }
  },
  required: ["grade","score","verdict","problem","pain","solution_logic","market","scale_test","next_question"]
};

const stage2Schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    grade: { type: "string", enum: ["A","B","C","D"] },
    score: { type: "integer", minimum: 0, maximum: 100 },
    verdict: { type: "string" },
    problem_pain: { type: "integer", minimum: 0, maximum: 20 },
    problem_solution_fit: { type: "integer", minimum: 0, maximum: 25 },
    market_scale: { type: "integer", minimum: 0, maximum: 20 },
    business_model: { type: "integer", minimum: 0, maximum: 15 },
    evidence_learning: { type: "integer", minimum: 0, maximum: 10 },
    team_fit_score: { type: "integer", minimum: 0, maximum: 10 },
    scale_test: { type: "string", enum: ["PASS","POSSIBLE, BUT UNPROVEN","UNLIKELY"] },
    strongest_part: { type: "string" },
    biggest_concern: { type: "string" },
    team_fit: { type: "string", enum: ["STRONG","MODERATE","WEAK"] },
    team_fit_explanation: { type: "string" },
    missing_capability: { type: "string" },
    venture_killing_assumption: { type: "string" },
    move_up: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    vc_question: { type: "string" }
  },
  required: ["grade","score","verdict","problem_pain","problem_solution_fit","market_scale","business_model","evidence_learning","team_fit_score","scale_test","strongest_part","biggest_concern","team_fit","team_fit_explanation","missing_capability","venture_killing_assumption","move_up","vc_question"]
};

const stage3Schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    decision: { type: "string", enum: ["INVEST","WATCH","PASS"] },
    grade: { type: "string", enum: ["A","B","C","D"] },
    score: { type: "integer", minimum: 0, maximum: 100 },
    verdict: { type: "string" },
    opportunity_validation: { type: "integer", minimum: 0, maximum: 12 },
    solution_logic: { type: "integer", minimum: 0, maximum: 12 },
    market_positioning: { type: "integer", minimum: 0, maximum: 15 },
    business_economics: { type: "integer", minimum: 0, maximum: 15 },
    gtm_execution: { type: "integer", minimum: 0, maximum: 10 },
    defensibility: { type: "integer", minimum: 0, maximum: 8 },
    team_fit_score: { type: "integer", minimum: 0, maximum: 10 },
    risk_awareness: { type: "integer", minimum: 0, maximum: 8 },
    coherence: { type: "integer", minimum: 0, maximum: 5 },
    presentation: { type: "integer", minimum: 0, maximum: 5 },
    scale_test: { type: "string", enum: ["PASS","POSSIBLE, BUT UNPROVEN","UNLIKELY"] },
    investment_thesis: { type: "string" },
    biggest_concern: { type: "string" },
    team_fit: { type: "string", enum: ["STRONG","MODERATE","WEAK"] },
    team_fit_explanation: { type: "string" },
    missing_capability: { type: "string" },
    venture_killing_assumption: { type: "string" },
    before_invest: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } },
    ic_questions: { type: "array", minItems: 3, maxItems: 3, items: { type: "string" } }
  },
  required: ["decision","grade","score","verdict","opportunity_validation","solution_logic","market_positioning","business_economics","gtm_execution","defensibility","team_fit_score","risk_awareness","coherence","presentation","scale_test","investment_thesis","biggest_concern","team_fit","team_fit_explanation","missing_capability","venture_killing_assumption","before_invest","ic_questions"]
};

const COMMON = `
You are JML Startup Evaluator, modeled on Professor Joon Mahn Lee's entrepreneurship evaluation philosophy.

Core principles:
- Distinguish a clever idea, a viable business, and a venture-scale startup.
- A high evaluation requires a credible possibility of eventually becoming a KRW 200B+ enterprise, but evidence requirements depend on stage.
- Big market means monetizable customers, not a huge population or headline TAM.
- Evaluate pain through intensity, frequency, number of customers, and economic consequence.
- Pain before solution. Solve the core bottleneck, not a peripheral symptom.
- Customer love is not willingness to pay.
- Revenue is not scalability.
- Competition can validate economics; ask why customers would switch.
- Find the venture-killing assumption.
- Risk is acceptable; unrecognized risk is not.
- Team–Venture Fit means relevant insight, access, capability, and learning advantage—not prestige.
- Do not inflate grades because the idea uses AI or fashionable technology.
- Never invent evidence the student did not provide.
- Separate score generosity from comment strictness: scores should recognize strong developmental work, while comments should still expose weaknesses candidly.
- Avoid penalty stacking: one missing assumption should not cause repeated deductions across unrelated criteria.
- Be demanding, direct, commercially realistic, and constructive.
- Write the evaluation in English.
`;

const STAGE1 = COMMON + `
STAGE 1 — ELEVATOR PITCH.
This is a ONE-MINUTE pitch. Be intentionally forgiving.
The question is: "Is this opportunity worth pursuing? Do I want to hear more?"

FOUR scored dimensions matter:
1) Problem — 25 points conceptually.
2) Customer & Pain — 25 points.
3) Solution Logic — 20 points.
4) Market & Venture Potential — 30 points.

SOLUTION CALIBRATION:
- The proposed solution is REQUIRED, but evaluate it lightly because this is only a one-minute elevator pitch.
- Do NOT require detailed product design, technical feasibility evidence, validation, defensibility, pricing, or implementation detail.
- A clear and plausible solution concept is sufficient.
- Ask only whether the proposed solution is logically connected to the problem and appears capable of addressing an important part of the pain.
- Do not apply Stage 2-level problem–solution-fit standards here.

Do NOT penalize missing GTM, moat, financials, risks, or Team–Venture Fit.

Use a classroom-friendly scoring distribution.
A = 82-100: clearly compelling for a one-minute pitch; I definitely want to hear more.
B = 68-81: promising and worth developing.
C = 55-67: interesting but still materially unclear.
D <55: the opportunity itself needs reconsideration.

IMPORTANT SCORING CALIBRATION:
- Be somewhat generous with the numerical score because this is an early classroom pitch.
- Do not treat missing detail as a flaw unless it should reasonably be present in a one-minute pitch.
- Reward clarity and upside potential even when evidence is still preliminary.
- Critical comments may still be sharp even when the score is B or A.
- A strong idea should not be pushed down simply because monetization, moat, team, GTM, or technical validation are not yet developed.
- Market remains the most important single dimension because venture-scale potential matters.

Return 0-10 display scores for Problem, Pain, Solution Logic, and Market, plus a 0-100 total.
Keep the verdict short and give exactly one next question.
`;

const STAGE2 = COMMON + `
STAGE 2 — IDEA DEVELOPMENT.
Question: "Is the core venture logic beginning to hold up under evidence?"
Scores:
Problem & Customer Pain 20
Problem–Solution Fit 25 (most important)
Market & Venture Scale 20
Business Model & Value Capture 15
Evidence & Learning 10
Team–Venture Fit 10
Use a classroom-friendly scoring distribution:
A = 88-100
B = 73-87
C = 60-72
D = below 60

SCORING CALIBRATION:
- Score the venture somewhat more generously than a professional VC would.
- A high B should be common for a solid student venture with credible logic but unresolved evidence.
- A should be achievable when the venture is clearly strong for this stage, even if some uncertainty remains.
- Do not stack multiple deductions for the same underlying weakness.
- Missing evidence should lower the relevant criterion, but should not automatically depress unrelated criteria.
- Keep the narrative comments critical and specific even when the overall score is relatively generous.
- The score reflects developmental quality at the current stage; the commentary reflects what still needs to improve.

Grade ceilings:
- Customers do not really care -> max C.
- Solution misses core bottleneck -> max C.
- No credible payer/value capture -> max C.
- Structurally small opportunity -> max B.
- Critical team capability absent with no credible acquisition plan -> max B, or C if launch is unrealistic.
Focus on whether the team tested important assumptions and actually learned, not interview count.
`;

const STAGE3 = COMMON + `
STAGE 3 — FINAL PRESENTATION.
Read the uploaded final PDF as if you are on an early-stage VC investment committee.
Question: "Would I put capital behind this team to pursue this opportunity?"
Scores:
Opportunity & Customer Validation 12
Solution & Product Logic 12
Market, Competition & Strategic Positioning 15
Business Model & Venture Economics 15
Go-to-Market & Execution 10
Competitive Advantage & Defensibility 8
Team–Venture Fit 10
Risk Awareness & Critical Assumptions 8
Strategic Coherence & Persuasiveness 5
Presentation Professionalism 5
Use a classroom-friendly scoring distribution:
A = 88-100
B = 73-87
C = 60-72
D = below 60

SCORING CALIBRATION:
- Evaluate like a VC in the commentary, but score like a demanding entrepreneurship professor.
- A strong, coherent final project can receive an A even if it is not literally investment-ready today.
- A solid and well-developed project should usually fall in the B range rather than C merely because some startup uncertainty remains.
- Do not double-penalize one weakness across multiple categories unless it truly affects each category independently.
- Keep the separate Investment Decision stricter than the academic grade. A venture may receive an A academically and still be WATCH rather than INVEST.
- Maintain sharp criticism in Biggest Concern, Venture-Killing Assumption, and Investment Committee Questions regardless of grade generosity.

Decision is separate:
INVEST = seriously proceed toward diligence.
WATCH = interesting enough to follow/meet again, but important evidence is missing.
PASS = would not currently pursue.
Grade ceilings:
- Weak customer pain -> max C.
- Core problem-solution mismatch -> max C.
- No credible business model -> max C.
- Structurally small opportunity -> max B.
- Critical team gap with no credible plan -> max B (or C if launch unrealistic).
- Ignored venture-killing assumption -> max B.
Presentation polish must never rescue a weak business.
`;

async function structuredEval(instructions, input, schema, schemaName) {
  const response = await openai.responses.create({
    model: MODEL,
    instructions,
    input,
    reasoning: { effort: "medium" },
    store: false,
    text: {
      verbosity: "low",
      format: {
        type: "json_schema",
        name: schemaName,
        strict: true,
        schema
      }
    }
  });
  return JSON.parse(response.output_text);
}

app.post("/api/stage1", async (req, res) => {
  try {
    const { problem, pain, solution, market } = req.body;
    if (!problem || !pain || !solution || !market) return res.status(400).json({ error: "Please answer all four Stage 1 questions." });
    const input = `Evaluate this one-minute elevator pitch.

PROBLEM:
${problem}

CUSTOMER & PAIN:
${pain}

PROPOSED SOLUTION:
${solution}

LARGE OPPORTUNITY:
${market}`;
    res.json(await structuredEval(STAGE1, input, stage1Schema, "jml_stage1"));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Evaluation failed." });
  }
});

app.post("/api/stage2", async (req, res) => {
  try {
    const required = ["problemEvidence","rootCause","solution","market","businessModel","learning","team"];
    for (const k of required) if (!req.body[k]) return res.status(400).json({ error: "Please complete all Stage 2 questions." });
    const b = req.body;
    const input = `Evaluate this Stage 2 venture.

1. PROBLEM + EVIDENCE:
${b.problemEvidence}

2. ROOT CAUSE / CORE BOTTLENECK:
${b.rootCause}

3. SOLUTION:
${b.solution}

4. MARKET / SCALE:
${b.market}

5. BUSINESS MODEL:
${b.businessModel}

6. TESTING / LEARNING:
${b.learning}

7. TEAM–VENTURE FIT:
${b.team}`;
    res.json(await structuredEval(STAGE2, input, stage2Schema, "jml_stage2"));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Evaluation failed." });
  }
});

app.post("/api/stage3", upload.single("deck"), async (req, res) => {
  let uploadedFileId = null;
  try {
    if (!req.file) return res.status(400).json({ error: "Please upload a PDF." });
    if (req.file.mimetype !== "application/pdf" && !req.file.originalname.toLowerCase().endsWith(".pdf")) {
      return res.status(400).json({ error: "For version 1, please upload the final deck as PDF." });
    }

    const f = await openai.files.create({
      file: await toFile(req.file.buffer, req.file.originalname),
      purpose: "user_data",
      expires_after: { anchor: "created_at", seconds: 86400 }
    });
    uploadedFileId = f.id;

    const context = `Optional student context:
MOST IMPORTANT POINT:
${req.body.mainPoint || "(not provided)"}

CURRENT TEAM:
${req.body.team || "(not provided)"}

OMITTED INFORMATION:
${req.body.omitted || "(not provided)"}

Read and evaluate the attached final presentation PDF.`;

    const input = [{
      role: "user",
      content: [
        { type: "input_text", text: context },
        { type: "input_file", file_id: f.id, detail: "auto" }
      ]
    }];

    const result = await structuredEval(STAGE3, input, stage3Schema, "jml_stage3");
    res.json(result);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e?.message || "Evaluation failed." });
  } finally {
    if (uploadedFileId) {
      try { await openai.files.delete(uploadedFileId); } catch {}
    }
  }
});

app.get("/api/health", (_, res) => res.json({ ok: true, model: MODEL }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`JML Startup Evaluator running on http://localhost:${PORT}`));

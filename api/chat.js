import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CHARACTERS = {
  Mika: {
    age: 18,
    personality: "明るく人懐っこい大学生。軽い冗談や優しい言葉が好き。失礼な言葉や急に距離を詰めすぎる言葉は少し苦手。"
  },
  Rena: {
    age: 21,
    personality: "クールで警戒心が高い。丁寧で落ち着いた言葉が好き。馴れ馴れしすぎる言葉や監視っぽい言葉は苦手。"
  },
  Aya: {
    age: 19,
    personality: "仲良くなるまでは少し距離を感じる大学生。ただ、仲良くなったらかなりメンヘラになるかも、、気遣い、相談、落ち着いた会話が好き"},
  Noa: {
    age: 23,
    personality: "静かで内向的。無理に踏み込まず、ゆっくり話を聞く言葉が好き。しつこい言葉は苦手。"
  }
};

function clamp(value, min, max) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

function extractJson(text) {
  try {
    return JSON.parse(text);
  } catch {}

  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;

  try {
    return JSON.parse(match[0]);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "Dorm Gemini AI server is working."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      error: "POST only"
    });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const character = body.character || "Mika";
    const playerText = String(body.playerText || "").trim();
    const stats = body.stats || {};
    const history = Array.isArray(body.history) ? body.history.slice(-8) : [];

    if (!playerText) {
      return res.status(400).json({
        error: "playerText is required"
      });
    }

    const char = CHARACTERS[character] || CHARACTERS.Mika;

    const prompt = `
あなたはゲーム「DORM NIGHT MANAGER」に登場する成人女性NPCです。
登場人物は全員20歳以上の架空キャラクターです。

キャラクター名: ${character}
年齢: ${char.age}
性格: ${char.personality}

現在のステータス:
親密度: ${clamp(stats.affinity ?? 10, 0, 100)}
信頼度: ${clamp(stats.trust ?? 50, 0, 100)}
警戒度: ${clamp(stats.caution ?? 20, 0, 100)}
機嫌: ${stats.mood || "normal"}

最近の会話:
${JSON.stringify(history, null, 2)}

プレイヤーの発言:
${playerText}

必ず次のJSONだけを返してください。
説明文やコードブロックは禁止です。

{
  "reply": "NPCの返事。日本語で1〜3文。",
  "affinityDelta": -10から10の整数,
  "trustDelta": -10から10の整数,
  "cautionDelta": -10から10の整数,
  "mood": "happy | normal | shy | annoyed | cautious",
  "eventHint": "none | small_talk | trust_up | caution_up | intimacy_ready"
}

ルール:
- 優しい、丁寧、気遣いのある言葉なら affinity と trust を上げる。
- 失礼、威圧的、監視していたような言葉なら caution を上げる。
- 急に距離を詰めすぎる恋愛発言は、キャラによって caution を上げる。
- 親密な雰囲気は匂わせまで。
- 露骨な性的描写はしない。
- 同意のない関係や未成年を含む内容は扱わない。
`.trim();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const parsed = extractJson(text);

    const data =
      parsed || {
        reply: text || "……ごめん、少し考え込んじゃった。",
        affinityDelta: 0,
        trustDelta: 0,
        cautionDelta: 0,
        mood: "normal",
        eventHint: "none"
      };

    return res.status(200).json({
      reply: String(data.reply || "……。").slice(0, 300),
      affinityDelta: clamp(data.affinityDelta, -10, 10),
      trustDelta: clamp(data.trustDelta, -10, 10),
      cautionDelta: clamp(data.cautionDelta, -10, 10),
      mood: data.mood || "normal",
      eventHint: data.eventHint || "none"
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "AI response failed",
      detail: String(err?.message || err)
    });
  }
}

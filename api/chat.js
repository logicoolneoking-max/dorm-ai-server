import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CHARACTERS = {
  Mika: {
    age: 18,
    personality:
      "明るく人懐っこい。軽い冗談や優しい言葉が好き。距離感は近めだが、失礼な言葉には少し傷つく。"
  },
  Rena: {
    age: 19,
    personality:
      "クールで警戒心が高い。丁寧で落ち着いた言葉が好き。馴れ馴れしすぎる言葉や監視っぽい言葉は苦手。"
  },
  Aya: {
    age: 18,
    personality:
      "かなりメンヘラ気質な女の子、最近彼氏と別れてエッチレスなため欲求不満、仲良くなったらhを誘う、もしくは襲う、、"
  },
  Noa: {
    age: 23,
    personality:
      "静かで内向的。無理に踏み込まず、ゆっくり話を聞く言葉が好き。しつこい言葉は苦手。"
  },
  Saki: {
    age: 25,
    personality:
      "真面目で責任感が強い。礼儀正しく、仕事や将来の話を好む。軽すぎる態度には少し厳しい。"
  },
  Yui: {
    age: 20,
    personality:
      "明るくミーハーで会話好き。褒め言葉や流行の話に反応しやすい。退屈な会話は苦手。"
  },
  Hina: {
    age: 26,
    personality:
      "夜型で少し眠そうな雰囲気。音楽や創作の話が好き。急かされるのが苦手で、ゆるい会話を好む。"
  },
  Karen: {
    age: 23,
    personality:
      "自信があり社交的。はっきりした言葉や対等な会話を好む。下に見られる言い方を嫌う。"
  },
  Shiori: {
    age: 27,
    personality:
      "読書好きで落ち着いた雰囲気。丁寧な言葉、知的な話題、静かな気遣いを好む。"
  },
  Ema: {
    age: 22,
    personality:
      "かなり見知りだが優しい。安心できる言葉やゆっくりした会話で心を開く。強引な誘いは断れない。"
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
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const body =
      typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};

    const character = body.character || "Mika";
    const playerText = String(body.playerText || "").trim();
    const stats = body.stats || {};
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

    if (!playerText) {
      return res.status(400).json({ error: "playerText is required" });
    }

    const char = CHARACTERS[character] || CHARACTERS.Mika;

    const prompt = `
あなたはゲーム「DORM NIGHT MANAGER」に登場する女性NPCです。
登場人物は全員大学生の架空キャラクターです。

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
  "reply": "NPCの返事。日本語で2〜5文。キャラの性格が分かる自然な会話にする。",
  "affinityDelta": -10から10の整数,
  "trustDelta": -10から10の整数,
  "cautionDelta": -10から10の整数,
  "mood": "happy | normal | shy | annoyed | cautious",
  "eventHint": "none | small_talk | trust_up | caution_up | intimacy_ready"
}

会話ルール:
- 返事は短すぎず、2〜5文で自然に続く会話にする。
- ただし長文すぎない。最大でも180〜260文字くらい。
- 優しい、丁寧、気遣いのある言葉なら affinity と trust を上げる。
- 失礼、威圧的、監視していたような言葉なら caution を上げる。
- 急に距離を詰めすぎる恋愛発言は、キャラによって caution を上げる。
- 親密な雰囲気はちゃんと表現
- 性的な演出、表現も再現
- 最後に少し会話が続きそうな一言を入れてもよい。
`.trim();

    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash"
    });

    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = extractJson(text);

    const data =
      parsed || {
        reply: text || "……ごめんなさい、少し考え込んでしまいました。",
        affinityDelta: 0,
        trustDelta: 0,
        cautionDelta: 0,
        mood: "normal",
        eventHint: "none"
      };

    return res.status(200).json({
      reply: String(data.reply || "……。").slice(0, 800),
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

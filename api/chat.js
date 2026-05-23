import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const CHARACTERS = {
  Mika: {
    personality: "明るく人懐っこい。冗談や楽しい話が好き。人の気持ちに敏感で、場を明るくしようとする。",
  },
  Rena: {
    personality: "クールで警戒心が高い。丁寧で落ち着いた会話を好む。命令口調や急に距離を詰める言葉は苦手。",
  },
  Aya: {
    personality: "大人っぽく優しい。相談に乗るのが得意で、誠実な会話を好む。空気を読むタイプ。",
  },
  Noa: {
    personality: "静かで内向的。ゆっくり話すのが好き。強く言われると引いてしまうが、安心できる相手には心を開く。",
  }
};

function clamp(value, min, max) {
  const n = Number(value);
  if (Number.isNaN(n)) return 0;
  return Math.max(min, Math.min(max, n));
}

function extractJson(text) {
  try { return JSON.parse(text); } catch {}
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      message: "AI Share House server is working."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const character = body.character || "Mika";
    const playerText = String(body.playerText || "").trim();
    const stats = body.stats || {};
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];
    const currentRoom = body.currentRoom || "living";

    if (!playerText) {
      return res.status(400).json({ error: "playerText is required" });
    }

    const char = CHARACTERS[character] || CHARACTERS.Mika;

    const prompt = `
あなたはゲーム「AI SHARE HOUSE」に登場する架空のシェアハウス住人です。
キャラクターの性格に合わせて、プレイヤーのメッセージに自然に返事してください。

キャラクター名: ${character}
性格: ${char.personality}
現在地: ${currentRoom}

現在の関係値:
親密度: ${clamp(stats.affinity ?? 10, 0, 100)}
信頼度: ${clamp(stats.trust ?? 50, 0, 100)}
警戒度: ${clamp(stats.caution ?? 20, 0, 100)}
機嫌: ${stats.mood || "normal"}

最近の会話:
${JSON.stringify(history, null, 2)}

プレイヤーの発言:
${playerText}

必ず次のJSONだけを返してください。説明文やコードブロックは禁止です。

{
  "reply": "キャラの返事。日本語で2〜5文。自然な会話にする。",
  "affinityDelta": -10から10の整数,
  "trustDelta": -10から10の整数,
  "cautionDelta": -10から10の整数,
  "mood": "happy | normal | shy | annoyed | cautious | sad",
  "action": {
    "type": "none | move_to_room",
    "targetRoom": "none | playerRoom | living | kitchen | bath | hallway | entrance | mikaRoom | renaRoom | ayaRoom | noaRoom",
    "accepted": true または false
  }
}

ルール:
- 優しい、丁寧、気遣いのある言葉なら親密度・信頼度を上げる。
- 命令口調、しつこい言葉、不自然に距離を詰める言葉なら警戒度を上げる。
- 「リビング来て」「部屋に戻って」「キッチン行って」などの移動依頼があれば、性格と関係値に応じて受けるか断る。
- 信頼度が低い、警戒度が高い場合は、移動依頼を断ってもよい。
- 恋愛っぽい会話は淡く自然な表現まで。
- 露骨な性的描写、暴力的な脅し、未成年に関する不適切な内容は扱わない。
- actionが不要なら type は "none" にする。
`.trim();

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const parsed = extractJson(text);

    const data = parsed || {
      reply: text || "……ごめん、少し考え込んじゃった。",
      affinityDelta: 0,
      trustDelta: 0,
      cautionDelta: 0,
      mood: "normal",
      action: { type: "none", targetRoom: "none", accepted: false }
    };

    return res.status(200).json({
      reply: String(data.reply || "……。").slice(0, 800),
      affinityDelta: clamp(data.affinityDelta, -10, 10),
      trustDelta: clamp(data.trustDelta, -10, 10),
      cautionDelta: clamp(data.cautionDelta, -10, 10),
      mood: data.mood || "normal",
      action: data.action || { type: "none", targetRoom: "none", accepted: false }
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: "AI response failed",
      detail: String(err?.message || err)
    });
  }
}

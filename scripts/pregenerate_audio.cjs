const { GoogleGenAI } = require('@google/genai');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const segments = [
  {
    id: 'seg-1',
    speaker: 'female',
    voiceName: 'Kore',
    style: 'Inquisitive female question ~300 Hz pitch, clear Sanskrit articulation',
    text: 'आचार्यवर्य, भवन्तः कथयन्ति यत् ज्योतिषशास्त्रस्य कोऽपि वैज्ञानिकः प्रमाणः नास्ति, अतः तत् सम्यक् नास्ति।'
  },
  {
    id: 'seg-2',
    speaker: 'female',
    voiceName: 'Kore',
    style: 'Inquisitive female question ~300 Hz pitch, clear Sanskrit articulation',
    text: 'एवमेव अद्वैतवेदान्तस्यापि कोऽपि वैज्ञानिक-प्रमाणः नास्ति। तर्हि विज्ञानस्य निकषे केवलं ज्योतिषमेव किमर्थं परीक्ष्यते? भवतां स्वकीयाः दार्शनिकाः पक्षाः किमर्थं न?'
  },
  {
    id: 'seg-3',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, calm ironic tone',
    text: 'प्रेम-सदृशं किमपि न वर्तते। आगच्छन्तु, निराकुर्मः।'
  },
  {
    id: 'seg-4',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, inquisitive rhetorical tone',
    text: 'किं प्रेम निराकुर्मः?'
  },
  {
    id: 'seg-5',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, witty confident tone',
    text: 'तर्हि प्रेम्णः वैज्ञानिकं प्रमाणम् आनयन्तु।'
  },
  {
    id: 'seg-6',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, questioning tone',
    text: 'प्रेम-सदृशं किमपि न भवति?'
  },
  {
    id: 'seg-7',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, serious emphatic Sanskrit delivery',
    text: 'अये भोः, द्वौ भिन्नौ आयामौ स्तः। द्वे अतीव भिन्ने क्षेत्रे स्तः। द्वे भिन्ने कोट्यौ स्तः। एते परस्परं किमर्थं सम्मिश्रयन्ति?'
  },
  {
    id: 'seg-8',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, serious analytical delivery',
    text: 'तत् विज्ञानस्य निकषे स्थापनीयं भविष्यति।'
  },
  {
    id: 'seg-9',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, calm philosophical delivery',
    text: 'यत् च वेदान्तः वदति, तत् केवलम् अहङ्काराय एव अस्ति।'
  },
  {
    id: 'seg-10',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, authoritative Sanskrit delivery',
    text: 'अहङ्कारः च विज्ञानस्य परिभाषायाः बहिर्भूतः अस्ति।'
  },
  {
    id: 'seg-11',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, clear storytelling cadence',
    text: 'बुद्धः अशीति-किलोग्राम-भारयुक्तः स्यात्, अङ्गुलीमालोऽपि अशीति-किलोग्राम-भारयुक्तः स्यात्,'
  },
  {
    id: 'seg-12',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, intense analytical Sanskrit cadence',
    text: 'उभयोः उपरि गुरुत्वाकर्षण-बलं समानमेव प्रवर्तिष्यते, यतो हि विज्ञानस्य आत्मनः गुणवत्तया सह कोऽपि सम्बन्धः नास्ति।'
  },
  {
    id: 'seg-13',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, inquisitive cadence',
    text: 'वार्ता अवगम्यते वा?'
  },
  {
    id: 'seg-14',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, serious philosophical cadence',
    text: 'विज्ञानं केवलं जड-द्रव्यस्य चर्चां करोति, ज्योतिषमपि च यतो हि जड-द्रव्यस्यैव चर्चां करोति, अतः तत् विज्ञानस्य परिधौ आगच्छति।'
  },
  {
    id: 'seg-15',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, calm profound delivery',
    text: 'अद्वैत-वेदान्तः तां वार्तां वदति या विज्ञानस्य परिभाषायाः सर्वथा बहिर्भूता वर्तते।'
  },
  {
    id: 'seg-16',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, meditative delivery',
    text: 'तत् वचनं केवलम् अहङ्कारस्य निवृत्तये अस्ति, अहङ्कारः च विज्ञानस्य सीम्नः परे वर्तते।'
  },
  {
    id: 'seg-17',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, authoritative Sanskrit delivery',
    text: 'भौतिक-विज्ञानं पिण्डानाम् अध्ययनं करोति, न तु चेतनायाः। यदा ज्योतिषं भौतिक-पिण्डानां प्रभावस्य दावां करोति, तदा तेन प्रमाणं दातव्यमेव।'
  },
  {
    id: 'seg-18',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, clear conclusive delivery',
    text: 'अतः विज्ञानं ज्योतिषशास्त्रात् प्रमाणं याचते। अयं न कोऽपि पक्षपातः, एतत् तु उभयोः भिन्नं स्वरूपम् अस्ति।'
  },
  {
    id: 'seg-19',
    speaker: 'male',
    voiceName: 'Fenrir',
    style: 'Deep resonant male baritone ~120 Hz, serene enlightened cadence',
    text: 'वेदान्तस्य प्रमाणं भवतः स्वकीया मुक्तिः एव, न तु कस्यापि prayogaśālāyāḥ उपकरणम्।'
  }
];

const outDir = path.join(process.cwd(), 'public', 'audio', 'dubbed');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function synthesizeWithRetry(ai, seg, attempt = 1) {
  const filePath = path.join(outDir, `${seg.id}.wav`);
  if (fs.existsSync(filePath) && fs.statSync(filePath).size > 1000) {
    console.log(`[EXISTS] ${seg.id} already exists (${fs.statSync(filePath).size} bytes)`);
    return true;
  }

  try {
    console.log(`Synthesizing ${seg.id} (${seg.speaker}, ${seg.voiceName})... attempt ${attempt}`);
    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash-tts',
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: seg.text,
              speechMetadata: {
                style: seg.style,
              },
            },
          ],
        },
      ],
      config: {
        responseModalities: ['AUDIO'],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: seg.voiceName },
          },
        },
      },
    });

    const b64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (b64) {
      fs.writeFileSync(filePath, Buffer.from(b64, 'base64'));
      console.log(`[SUCCESS] ${seg.id} saved (${fs.statSync(filePath).size} bytes)`);
      return true;
    }
  } catch (err) {
    const isRateLimit = err?.status === 429 || err?.message?.includes('429') || err?.message?.includes('quota');
    if (isRateLimit && attempt <= 5) {
      const waitTime = 22000;
      console.warn(`[RATE LIMIT] Waiting ${waitTime/1000}s before retry for ${seg.id}...`);
      await sleep(waitTime);
      return synthesizeWithRetry(ai, seg, attempt + 1);
    }
    console.error(`[ERROR] ${seg.id}:`, err?.message || err);
    return false;
  }
}

async function main() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  console.log(`Starting pregeneration of ${segments.length} segments...`);
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    await synthesizeWithRetry(ai, seg);
    // Be courteous to rate limits: wait 3.5 seconds between successful calls
    await sleep(3500);
  }
  console.log('All audio segments processed!');
}

main().catch(console.error);

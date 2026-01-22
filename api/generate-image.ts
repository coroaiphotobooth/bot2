import type { VercelRequest, VercelResponse } from '@vercel/node';
import { GoogleAuth } from 'google-auth-library';

export const config = {
  maxDuration: 60,
};

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { image, prompt, aspectRatio, modelKey } = req.body;

    if (!prompt) return res.status(400).json({ error: 'Missing prompt' });

    // --- 1. Vertex Auth ---
    const projectId = process.env.GCP_PROJECT_ID;
    const clientEmail = process.env.GCP_CLIENT_EMAIL;
    const rawPrivateKey = process.env.GCP_PRIVATE_KEY;
    const location = 'us-central1'; // Pastikan region sesuai dengan ketersediaan model di Model Garden

    if (!projectId || !clientEmail || !rawPrivateKey) {
      return res.status(500).json({ error: 'Server Auth Config Error: Check GCP Credentials' });
    }

    const privateKey = rawPrivateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
    const auth = new GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey, project_id: projectId },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // --- 2. Model Selection (Direct Vertex ID) ---
    // Default fallback jika tidak ada selection
    let modelId = modelKey || 'gemini-2.5-flash-001';

    // Normalisasi ID dari Frontend ke Vertex ID yang valid
    // Frontend mengirim: 'gemini-2.5-flash-image' -> Vertex: 'gemini-2.5-flash-001' (atau -preview)
    // Frontend mengirim: 'gemini-3-pro-image' -> Vertex: 'gemini-3.0-pro-001'
    if (modelKey === 'gemini-2.5-flash-image') modelId = 'gemini-2.5-flash-001';
    if (modelKey === 'gemini-3-pro-image-preview') modelId = 'gemini-3.0-pro-001'; 
    
    console.log(`[VertexAI] Direct Call to Model: ${modelId}`);

    // --- 3. Gemini Native Image Generation (generateContent) ---
    // Gemini di Vertex AI menggunakan endpoint :generateContent untuk output gambar juga.
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:generateContent`;
    
    const base64Image = image.includes(',') ? image.split(',')[1] : image;

    // Payload untuk Gemini Multimodal (Image + Text Prompt -> Image Output)
    const payload = {
      contents: [{
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { mimeType: 'image/jpeg', data: base64Image } }
        ]
      }],
      generationConfig: {
        responseMimeType: "image/jpeg", // Memaksa output gambar
        // Aspect Ratio biasanya diatur dalam prompt untuk Gemini, atau parameter mediaConfig jika tersedia
      }
    };

    const apiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json; charset=utf-8'
      },
      body: JSON.stringify(payload)
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      console.error("Vertex API Error:", JSON.stringify(data));
      throw new Error(data.error?.message || `Vertex AI Error: ${data.error?.code}`);
    }

    // --- 4. Extract Image from Gemini Response ---
    // Gemini return: candidates[0].content.parts[].inlineData.data
    let resultBase64 = null;
    const parts = data.candidates?.[0]?.content?.parts;
    
    if (parts) {
      for (const part of parts) {
        if (part.inlineData && part.inlineData.data) {
          resultBase64 = part.inlineData.data;
          break;
        }
      }
    }

    if (!resultBase64) {
        console.warn("No image found in Vertex response:", JSON.stringify(data));
        throw new Error("Model finished but returned no image data. Ensure your prompt requests an image.");
    }

    return res.status(200).json({ image: `data:image/png;base64,${resultBase64}` });

  } catch (error: any) {
    console.error("API Handler Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
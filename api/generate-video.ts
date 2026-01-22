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
    const { image, prompt, aspectRatio } = req.body;

    if (!image || !prompt) {
      return res.status(400).json({ error: 'Missing image or prompt' });
    }

    // 1. Vertex Auth
    const projectId = process.env.GCP_PROJECT_ID;
    const clientEmail = process.env.GCP_CLIENT_EMAIL;
    const rawPrivateKey = process.env.GCP_PRIVATE_KEY;
    const location = 'us-central1';

    if (!projectId || !clientEmail || !rawPrivateKey) {
      return res.status(500).json({ error: 'Server Auth Config Error: Missing GCP Credentials' });
    }

    const privateKey = rawPrivateKey.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
    const auth = new GoogleAuth({
      credentials: { client_email: clientEmail, private_key: privateKey, project_id: projectId },
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    const client = await auth.getClient();
    const accessToken = await client.getAccessToken();

    // 2. Vertex Veo Model (Direct Call)
    // Sesuai request: Veo 3.1
    // Nama model di Vertex biasanya: veo-3.1-generate-preview (Standard) atau veo-3.1-fast-generate-preview (Fast)
    // Kita gunakan Fast untuk Kiosk.
    const modelId = 'veo-3.1-fast-generate-preview'; 
    const endpoint = `https://${location}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${location}/publishers/google/models/${modelId}:predict`;

    // 3. Prepare Payload (Veo uses predict endpoint)
    const base64Image = image.includes(',') ? image.split(',')[1] : image;
    
    // Normalisasi aspect ratio untuk Veo (Hanya support 16:9 atau 9:16)
    let veoAspect = aspectRatio || "9:16";
    if (aspectRatio === '3:2') veoAspect = '16:9';
    if (aspectRatio === '2:3') veoAspect = '9:16';

    const payload = {
      instances: [
        {
          prompt: prompt,
          image: {
             bytesBase64Encoded: base64Image
          }
        }
      ],
      parameters: {
        aspectRatio: veoAspect,
        sampleCount: 1,
        // fps: 24 // Optional
      }
    };

    console.log(`[VertexAI] Calling Veo Endpoint: ${modelId}`);

    const apiRes = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken.token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(payload),
    });

    const data = await apiRes.json();

    if (!apiRes.ok) {
      console.error("Vertex AI Veo Error:", JSON.stringify(data));
      throw new Error(data.error?.message || "Vertex AI Veo Generation Failed.");
    }

    // 4. Extract Video
    let videoBase64 = null;
    if (data.predictions && data.predictions.length > 0) {
      const pred = data.predictions[0];
      
      // Veo structure variations handling
      if (typeof pred === 'string') {
        videoBase64 = pred;
      } else if (pred.bytesBase64Encoded) {
        videoBase64 = pred.bytesBase64Encoded;
      } else if (pred.video?.bytesBase64Encoded) {
        videoBase64 = pred.video.bytesBase64Encoded;
      }
    }

    if (!videoBase64) {
      throw new Error("Model returned success but no video data found.");
    }

    return res.status(200).json({ video: `data:video/mp4;base64,${videoBase64}` });

  } catch (error: any) {
    console.error("API Handler Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
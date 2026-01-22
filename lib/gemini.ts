import { PhotoboothSettings, AspectRatio } from "../types";

/**
 * Mengirim gambar ke Server (Vercel Function) untuk dideteksi jumlah orangnya
 * menggunakan Vertex AI (Gemini Flash).
 */
const detectPeopleCount = async (base64: string): Promise<number> => {
  try {
    const response = await fetch('/api/detect-people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64 })
    });

    if (!response.ok) {
      console.warn("Detection API failed, defaulting to 1.");
      return 1;
    }

    const data = await response.json();
    return data.count || 1;
  } catch (e) {
    console.warn("Detection network error, defaulting to 1", e);
    return 1;
  }
};

/**
 * Fungsi Utama Generate Image.
 * Sekarang memanggil API /api/generate-image di Vercel.
 */
export const generateAIImage = async (base64Source: string, prompt: string, outputRatio: AspectRatio = '9:16') => {
  try {
    // 1. Ambil Settings
    const storedSettings = localStorage.getItem('pb_settings');
    let selectedModel = 'gemini-2.5-flash-image';
    
    if (storedSettings) {
      const parsedSettings: PhotoboothSettings = JSON.parse(storedSettings);
      if (parsedSettings.selectedModel) {
        selectedModel = parsedSettings.selectedModel;
      }
    }

    // 2. Logic Smart Detection (Client Side Logic, Server Side Execution)
    if (selectedModel === 'auto') {
       console.log("Auto Mode: Requesting server detection...");
       const personCount = await detectPeopleCount(base64Source);
       console.log(`Detected ${personCount} people.`);
       
       if (personCount > 1) {
          selectedModel = 'gemini-3-pro-image-preview'; // Group
          console.log("Switching to Model 3 Pro (Group Mode)");
       } else {
          selectedModel = 'gemini-2.5-flash-image'; // Single
          console.log("Switching to Model 2.5 Flash (Single Mode)");
       }
    }

    // 3. Prepare Prompt Strictness
    const finalPrompt = `*** EDIT MODE: HARD LOCK ENABLED ***
STRICT CONSTRAINTS:
1. PRESERVE IDENTITY: Face, features, and skin tone must remain EXACTLY the same.
2. PRESERVE STRUCTURE: Pose, posture, hand gestures, and body shape must remain EXACTLY the same.
3. PRESERVE FRAMING: Camera angle, zoom, and composition must remain EXACTLY the same. DO NOT CROP. DO NOT ZOOM.
4. PRESERVE HAIR/HEAD: Keep hairstyle/hijab shape identical unless explicitly asked to change.

CHANGE REQUEST:
${prompt}`;

    console.log(`Calling Vertex AI Wrapper for model: ${selectedModel}`);

    // 4. Call Vercel API
    const response = await fetch('/api/generate-image', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: base64Source,
        prompt: finalPrompt,
        modelKey: selectedModel, // Kirim key model (e.g., 'gemini-2.5-flash-image'), backend yg mapping ke Vertex ID
        aspectRatio: outputRatio
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || `Server Error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.image) throw new Error("No image returned from server");

    return data.image; // Returns data:image/png;base64,...

  } catch (error: any) {
    console.error("Vertex AI Generation Error:", error);
    throw error;
  }
};

/**
 * Fungsi Generate Video (Veo).
 * Memanggil API /api/generate-video di Vercel.
 */
export const generateVeoVideo = async (base64Image: string, prompt: string, outputRatio: AspectRatio) => {
  try {
    console.log("Initialize Veo Generation (Server-Side Vertex AI)...");

    // Veo support 16:9 or 9:16
    const veoAspectRatio = (outputRatio === '16:9' || outputRatio === '3:2') ? '16:9' : '9:16';

    const response = await fetch('/api/generate-video', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: base64Image,
        prompt: prompt,
        aspectRatio: veoAspectRatio
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Server Error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.video) {
      throw new Error("Server returned success but no video data found.");
    }

    console.log("Video received from server!");

    // Convert Data URI to Blob
    const res = await fetch(data.video);
    const blob = await res.blob();
    return blob;

  } catch (error: any) {
    console.error("Veo Generation Error:", error);
    throw error;
  }
};
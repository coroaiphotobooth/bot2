
import { GalleryItem, PhotoboothSettings, Concept, EventRecord } from '../types';
import { DEFAULT_GAS_URL } from '../constants';

const getGasUrl = () => {
  return localStorage.getItem('APPS_SCRIPT_BASE_URL') || DEFAULT_GAS_URL;
};

export const fetchSettings = async () => {
  const url = getGasUrl();
  const response = await fetch(`${url}?action=getSettings&t=${Date.now()}`);
  return await response.json();
};

export const uploadToDrive = async (base64Image: string, metadata: any) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({
        action: 'uploadGenerated',
        image: base64Image,
        ...metadata
      })
    });
    return await response.json();
  } catch (error) {
    return { ok: false, error: "FETCH_FAILED" };
  }
};

export const uploadVideoToDrive = async (videoBlob: Blob, metadata: any) => {
  const url = getGasUrl();
  try {
    // Convert Blob to Base64
    const reader = new FileReader();
    return new Promise<any>((resolve) => {
      reader.onloadend = async () => {
        const base64Video = reader.result as string;
        const response = await fetch(url, {
          method: 'POST',
          body: JSON.stringify({
            action: 'uploadGeneratedVideo', 
            image: base64Video,
            mimeType: 'video/mp4',
            ...metadata
          })
        });
        resolve(await response.json());
      };
      reader.readAsDataURL(videoBlob);
    });
  } catch (error) {
    return { ok: false, error: "FETCH_FAILED" };
  }
};

export const fetchGallery = async (eventId?: string): Promise<GalleryItem[]> => {
  const url = getGasUrl();
  const query = eventId ? `&eventId=${eventId}` : '';
  // ADDED TIMESTAMP TO PREVENT BROWSER CACHING
  const response = await fetch(`${url}?action=gallery${query}&t=${Date.now()}`);
  const data = await response.json();
  return data.items || [];
};

export const fetchEvents = async (): Promise<EventRecord[]> => {
  const url = getGasUrl();
  const response = await fetch(`${url}?action=getEvents&t=${Date.now()}`);
  const data = await response.json();
  return data.items || [];
};

export const saveSettingsToGas = async (settings: PhotoboothSettings, pin: string) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'updateSettings', pin, settings })
    });
    const data = await response.json();
    return data.ok;
  } catch (error) { return false; }
};

export const uploadOverlayToGas = async (base64Image: string, pin: string) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'uploadOverlay', pin, image: base64Image })
    });
    return await response.json();
  } catch (error) { return { ok: false }; }
};

export const uploadBackgroundToGas = async (base64Image: string, pin: string) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'uploadBackground', pin, image: base64Image })
    });
    return await response.json();
  } catch (error) { return { ok: false }; }
};

export const uploadAudioToGas = async (base64Audio: string, pin: string) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'uploadAudio', pin, image: base64Audio }) 
    });
    return await response.json();
  } catch (error) { return { ok: false }; }
};

export const setActiveEventOnGas = async (id: string, pin: string) => {
  const url = getGasUrl();
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'setActiveEvent', id, pin })
  });
  return await response.json();
};

export const deletePhotoFromGas = async (id: string, pin: string) => {
  const url = getGasUrl();
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'deletePhoto', pin, id })
  });
  return await response.json();
};

export const deleteAllPhotosFromGas = async (pin: string) => {
  const url = getGasUrl();
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'deleteAllPhotos', pin })
  });
  return await response.json();
};

export const deleteEventOnGas = async (id: string, pin: string) => {
  const url = getGasUrl();
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'deleteEvent', id, pin })
  });
  return await response.json();
};

export const createEventOnGas = async (name: string, description: string, folderId: string, pin: string) => {
  const url = getGasUrl();
  const response = await fetch(url, {
    method: 'POST',
    body: JSON.stringify({ action: 'createEvent', name, description, folderId, pin })
  });
  return await response.json();
};

export const saveConceptsToGas = async (concepts: Concept[], pin: string) => {
  const url = getGasUrl();
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify({ action: 'updateConcepts', pin, concepts })
    });
    const data = await response.json();
    return data.ok;
  } catch (error) { return false; }
};

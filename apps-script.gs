
/**
 * BACKEND UNTUK CORO AI PHOTOBOOTH - FINAL VERSION
 * Mendukung: Image, Video (Veo), Audio, dan Settings
 * AUTO-INIT ENABLED: Tidak perlu jalankan setup() manual.
 */

const SCRIPT_PROP = PropertiesService.getScriptProperties();

// --- SETUP & INIT ---

function getOrInitSpreadsheet() {
  let ss = null;
  
  // 1. Coba ambil dari ID yang tersimpan di Properties
  const ssId = SCRIPT_PROP.getProperty('SPREADSHEET_ID');
  if (ssId) {
    try { ss = SpreadsheetApp.openById(ssId); } catch(e) {
      // ID ada tapi file tidak ditemukan/terhapus
      console.warn("Spreadsheet ID exists but failed to open: " + ssId);
    }
  }

  // 2. Jika tidak ada di properties, coba Active Sheet (jika script bound)
  if (!ss) {
    try { ss = SpreadsheetApp.getActiveSpreadsheet(); } catch(e) {}
  }

  // 3. Jika masih null, BUAT BARU OTOMATIS
  if (!ss) {
    ss = SpreadsheetApp.create('Coro AI Photobooth Database');
    SCRIPT_PROP.setProperty('SPREADSHEET_ID', ss.getId());
    ensureGallerySheet(ss); // Buat header sekalian
  }

  return ss;
}

function setup() {
  const ss = getOrInitSpreadsheet();
  ensureGallerySheet(ss);
  
  // Set Default PIN jika belum ada
  if (!SCRIPT_PROP.getProperty('ADMIN_PIN')) {
    SCRIPT_PROP.setProperty('ADMIN_PIN', '1234');
  }
  
  return "Setup Berhasil! ID Spreadsheet: " + ss.getId();
}

function ensureGallerySheet(ss) {
  let gallerySheet = ss.getSheetByName('Gallery');
  if (!gallerySheet) {
    gallerySheet = ss.insertSheet('Gallery');
    // Kolom: ID, Timestamp, Nama Konsep, URL Thumbnail, URL View/Download, Token, EventID, Tipe File (Image/Video)
    gallerySheet.appendRow(['id', 'createdAt', 'conceptName', 'imageUrl', 'downloadUrl', 'token', 'eventId', 'type']);
    gallerySheet.getRange(1, 1, 1, 8).setFontWeight("bold").setBackground("#bc13fe").setFontColor("white");
  }
  return gallerySheet;
}

// --- API HANDLERS ---

function doGet(e) {
  const action = e.parameter.action;
  const ss = getOrInitSpreadsheet(); 
  
  if (action === 'getSettings') {
    const storedConcepts = SCRIPT_PROP.getProperty('CONCEPTS_JSON');
    
    return createJsonResponse({
      ok: true,
      settings: {
        eventName: SCRIPT_PROP.getProperty('EVENT_NAME') || 'COROAI PHOTOBOOTH',
        eventDescription: SCRIPT_PROP.getProperty('EVENT_DESC') || 'Transform Your Reality',
        folderId: SCRIPT_PROP.getProperty('FOLDER_ID') || '',
        spreadsheetId: ss.getId(), 
        spreadsheetUrl: ss.getUrl(), 
        overlayImage: SCRIPT_PROP.getProperty('OVERLAY_IMAGE') || null,
        backgroundImage: SCRIPT_PROP.getProperty('BACKGROUND_IMAGE') || null,
        backgroundAudio: SCRIPT_PROP.getProperty('BACKGROUND_AUDIO') || null,
        videoPrompt: SCRIPT_PROP.getProperty('VIDEO_PROMPT') || 'Cinematic slow motion, subtle movement, 4k high quality, looping background',
        enableVideoGeneration: SCRIPT_PROP.getProperty('ENABLE_VIDEO_GEN') !== 'false', 
        monitorImageSize: SCRIPT_PROP.getProperty('MONITOR_IMG_SIZE') || 'medium',
        adminPin: SCRIPT_PROP.getProperty('ADMIN_PIN') || '1234',
        autoResetTime: parseInt(SCRIPT_PROP.getProperty('AUTO_RESET')) || 60,
        orientation: SCRIPT_PROP.getProperty('ORIENTATION') || 'portrait',
        outputRatio: SCRIPT_PROP.getProperty('OUTPUT_RATIO') || '9:16',
        cameraRotation: parseInt(SCRIPT_PROP.getProperty('CAMERA_ROTATION')) || 0
      },
      concepts: storedConcepts ? JSON.parse(storedConcepts) : null
    });
  }

  if (action === 'getEvents') {
     return createJsonResponse({ items: [] });
  }

  if (action === 'gallery') {
    const sheet = ss.getSheetByName('Gallery');
    if (!sheet) {
      ensureGallerySheet(ss);
      return createJsonResponse({ items: [] });
    }

    const values = sheet.getDataRange().getValues();
    if (values.length <= 1) return createJsonResponse({ items: [] });
    
    const headers = values[0];
    const items = values.slice(1)
      .filter(row => row[0] && row[0].toString().trim() !== "") 
      .map(row => {
        let obj = {};
        headers.forEach((h, i) => { obj[h] = row[i]; });
        return obj;
      });
      
    return createJsonResponse({ items: items.reverse() }); 
  }
  
  return createJsonResponse({ ok: true, message: "Coro AI API Active" });
}

function doPost(e) {
  let data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return createJsonResponse({ ok: false, error: 'Invalid JSON body' });
  }
  
  const action = data.action;
  
  // Handling Update Settings including Spreadsheet ID Link
  if (action === 'updateSettings') {
    const adminPin = SCRIPT_PROP.getProperty('ADMIN_PIN') || "1234";
    if (data.pin !== adminPin) return createJsonResponse({ ok: false, error: 'INVALID PIN' });

    const s = data.settings;
    if (s.eventName) SCRIPT_PROP.setProperty('EVENT_NAME', s.eventName);
    if (s.eventDescription) SCRIPT_PROP.setProperty('EVENT_DESC', s.eventDescription);
    if (s.folderId) SCRIPT_PROP.setProperty('FOLDER_ID', s.folderId);
    
    if (s.spreadsheetId && s.spreadsheetId.trim() !== '') {
       SCRIPT_PROP.setProperty('SPREADSHEET_ID', s.spreadsheetId.trim());
       try {
         const newSS = SpreadsheetApp.openById(s.spreadsheetId.trim());
         ensureGallerySheet(newSS);
       } catch(e) {
         return createJsonResponse({ ok: false, error: 'INVALID SPREADSHEET ID (Permission/Not Found)' });
       }
    }

    if (s.overlayImage) SCRIPT_PROP.setProperty('OVERLAY_IMAGE', s.overlayImage);
    if (s.backgroundImage) SCRIPT_PROP.setProperty('BACKGROUND_IMAGE', s.backgroundImage);
    if (s.backgroundAudio) SCRIPT_PROP.setProperty('BACKGROUND_AUDIO', s.backgroundAudio);
    if (s.videoPrompt) SCRIPT_PROP.setProperty('VIDEO_PROMPT', s.videoPrompt);
    if (s.enableVideoGeneration !== undefined) SCRIPT_PROP.setProperty('ENABLE_VIDEO_GEN', s.enableVideoGeneration.toString());
    if (s.monitorImageSize) SCRIPT_PROP.setProperty('MONITOR_IMG_SIZE', s.monitorImageSize);
    if (s.autoResetTime) SCRIPT_PROP.setProperty('AUTO_RESET', s.autoResetTime.toString());
    if (s.orientation) SCRIPT_PROP.setProperty('ORIENTATION', s.orientation);
    if (s.outputRatio) SCRIPT_PROP.setProperty('OUTPUT_RATIO', s.outputRatio);
    if (s.cameraRotation !== undefined) SCRIPT_PROP.setProperty('CAMERA_ROTATION', s.cameraRotation.toString());
    if (s.adminPin) SCRIPT_PROP.setProperty('ADMIN_PIN', s.adminPin);
    
    return createJsonResponse({ ok: true });
  }

  const ss = getOrInitSpreadsheet(); 
  const gallerySheet = ensureGallerySheet(ss); 

  // --- PUBLIC ACTIONS ---

  if (action === 'uploadGenerated' || action === 'uploadGeneratedVideo') {
    const folderId = data.folderId || SCRIPT_PROP.getProperty('FOLDER_ID');
    let folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (e) {
      folder = DriveApp.getRootFolder();
    }
    
    const isVideo = action === 'uploadGeneratedVideo';
    const timestamp = new Date().toISOString();
    let blob;
    let fileType;

    if (isVideo) {
      blob = Utilities.newBlob(Utilities.base64Decode(data.image.split(',')[1]), 'video/mp4', `VIDEO_${new Date().getTime()}.mp4`);
      fileType = 'video';
    } else {
      const parts = data.image.split(',');
      const mimeString = parts[0].split(':')[1].split(';')[0];
      blob = Utilities.newBlob(Utilities.base64Decode(parts[1]), mimeString, `PHOTO_${new Date().getTime()}.png`);
      fileType = 'image';
    }

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    
    const token = Utilities.getUuid();
    const thumbnailUrl = `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1000`;
    const viewUrl = `https://drive.google.com/file/d/${file.getId()}/view`;
    
    if (gallerySheet) {
      gallerySheet.appendRow([
        file.getId(), 
        timestamp, 
        data.conceptName, 
        thumbnailUrl, 
        viewUrl, 
        token, 
        data.eventId || "",
        fileType
      ]);
    }
    
    return createJsonResponse({
      ok: true,
      id: file.getId(),
      imageUrl: thumbnailUrl,
      viewUrl: viewUrl
    });
  }

  // --- ADMIN ACTIONS (Require PIN) ---

  const adminPin = SCRIPT_PROP.getProperty('ADMIN_PIN') || "1234";
  if (data.pin !== adminPin) {
     return createJsonResponse({ ok: false, error: 'INVALID PIN' });
  }

  if (action === 'updateConcepts') {
    SCRIPT_PROP.setProperty('CONCEPTS_JSON', JSON.stringify(data.concepts));
    return createJsonResponse({ ok: true });
  }

  // Delete Single Photo (Files & Database)
  if (action === 'deletePhoto') {
    const id = data.id;
    if (!id) return createJsonResponse({ok: false, error: 'No ID provided'});
    
    // 1. Try to delete FILE from Drive (Cleanup)
    try {
      const file = DriveApp.getFileById(id);
      file.setTrashed(true);
    } catch (e) {
      // Ignore if file not found or already deleted
    }

    // 2. Delete from Spreadsheet
    if (gallerySheet) {
      const lastRow = gallerySheet.getLastRow();
      if (lastRow > 1) {
        const ids = gallerySheet.getRange(2, 1, lastRow - 1, 1).getValues();
        const targetId = String(id).trim();
        
        // Loop backwards
        for (let i = ids.length - 1; i >= 0; i--) {
          if (String(ids[i][0]).trim() === targetId) {
            gallerySheet.deleteRow(i + 2); 
            SpreadsheetApp.flush(); // FORCE UPDATE
            return createJsonResponse({ ok: true });
          }
        }
      }
    }
    return createJsonResponse({ ok: false, error: 'ID not found in Database' });
  }
  
  // Delete ALL Photos (Database ONLY, Preserve Drive Files)
  if (action === 'deleteAllPhotos') {
    if (gallerySheet) {
       const lastRow = gallerySheet.getLastRow();
       if (lastRow > 1) {
         // Delete rows from 2 to last (keep header)
         gallerySheet.deleteRows(2, lastRow - 1);
         return createJsonResponse({ ok: true, message: "Database Cleared" });
       }
    }
    return createJsonResponse({ ok: true, message: "Database Already Empty" });
  }

  if (action === 'uploadOverlay' || action === 'uploadBackground' || action === 'uploadAudio') {
    const folderId = SCRIPT_PROP.getProperty('FOLDER_ID');
    let folder;
    try { folder = DriveApp.getFolderById(folderId); } catch(e) { folder = DriveApp.getRootFolder(); }
    
    let blob;
    let propKey;
    
    if (action === 'uploadOverlay') {
      blob = Utilities.newBlob(Utilities.base64Decode(data.image.split(',')[1]), 'image/png', 'overlay_asset.png');
      propKey = 'OVERLAY_IMAGE';
    } else if (action === 'uploadBackground') {
      const mime = data.image.indexOf('png') > -1 ? 'image/png' : 'image/jpeg';
      blob = Utilities.newBlob(Utilities.base64Decode(data.image.split(',')[1]), mime, 'background_asset.jpg');
      propKey = 'BACKGROUND_IMAGE';
    } else if (action === 'uploadAudio') {
      blob = Utilities.newBlob(Utilities.base64Decode(data.image.split(',')[1]), 'audio/mp3', 'background_audio.mp3');
      propKey = 'BACKGROUND_AUDIO';
    }

    const file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    let url = `https://drive.google.com/thumbnail?id=${file.getId()}&sz=w1920`;
    if (action === 'uploadAudio') url = `https://drive.google.com/uc?export=download&id=${file.getId()}`;

    SCRIPT_PROP.setProperty(propKey, url);
    return createJsonResponse({ ok: true, url: url });
  }

  return createJsonResponse({ ok: false, error: 'Unknown Action' });
}

function createJsonResponse(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

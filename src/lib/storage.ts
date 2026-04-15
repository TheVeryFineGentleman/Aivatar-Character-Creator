import { isCookiesAccepted } from "@/components/CookieConsent";

// Cookie utilities
export const setCookie = (name: string, value: string, days: number = 30) => {
  if (!isCookiesAccepted()) return;
  const date = new Date();
  date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
  const expires = `expires=${date.toUTCString()}`;
  const secureFlag = window.location.protocol === "https:" ? ";Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax${secureFlag}`;
};

export const getCookie = (name: string): string | null => {
  const nameEQ = `${name}=`;
  const cookies = document.cookie.split(';');
  for (let cookie of cookies) {
    cookie = cookie.trim();
    if (cookie.indexOf(nameEQ) === 0) {
      const rawValue = cookie.substring(nameEQ.length);
      try {
        return decodeURIComponent(rawValue);
      } catch {
        return rawValue;
      }
    }
  }
  return null;
};

export const deleteCookie = (name: string) => {
  document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;SameSite=Lax`;
};

// ============= BLOB URL MEMORY MANAGEMENT =============
// Prevents memory leaks on older/weaker devices
const MAX_BLOB_URLS = 80; // Increased for thumbnail + full-res pairs
const blobUrlRegistry: string[] = [];

export const createManagedBlobUrl = (blob: Blob): string => {
  try {
    // Clean up old URLs if limit reached
    while (blobUrlRegistry.length >= MAX_BLOB_URLS) {
      const oldUrl = blobUrlRegistry.shift();
      if (oldUrl) {
        try {
          URL.revokeObjectURL(oldUrl);
          console.log("🧹 Freed old Blob URL to save memory");
        } catch (e) {
          // Ignore revocation errors
        }
      }
    }
    
    const url = URL.createObjectURL(blob);
    blobUrlRegistry.push(url);
    return url;
  } catch (error) {
    console.error("Failed to create Blob URL:", error);
    throw new Error("Speicherfehler - zu wenig RAM");
  }
};

export const revokeManagedBlobUrl = (url: string) => {
  try {
    const index = blobUrlRegistry.indexOf(url);
    if (index > -1) {
      blobUrlRegistry.splice(index, 1);
    }
    URL.revokeObjectURL(url);
  } catch (e) {
    // Ignore revocation errors
  }
};

export const cleanupAllBlobUrls = () => {
  while (blobUrlRegistry.length > 0) {
    const url = blobUrlRegistry.pop();
    if (url) {
      try {
        URL.revokeObjectURL(url);
      } catch (e) {
        // Ignore revocation errors
      }
    }
  }
  console.log("🧹 All Blob URLs cleaned up");
};

// ============= LOCALSTORAGE PROTECTION =============
// Handles QuotaExceededError gracefully
export const safeLocalStorageSet = (key: string, value: any): { success: boolean; error?: string } => {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return { success: true };
  } catch (error: any) {
    console.error("LocalStorage error:", error);
    
    if (error?.name === 'QuotaExceededError' || 
        error?.code === 22 || 
        error?.message?.includes('quota')) {
      return { 
        success: false, 
        error: "Speicher voll - bitte Browser-Cache leeren" 
      };
    }
    
    return { 
      success: false, 
      error: "Speicherfehler" 
    };
  }
};

// Original localStorage utilities for larger data (images)
export const saveToLocalStorage = (key: string, value: any) => {
  if (!isCookiesAccepted()) return false;
  const result = safeLocalStorageSet(key, value);
  if (!result.success) {
    console.error("Error saving to localStorage:", result.error);
  }
  return result.success;
};

export const getFromLocalStorage = (key: string): any | null => {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : null;
  } catch (error) {
    console.error("Error reading from localStorage:", error);
    return null;
  }
};

export const removeFromLocalStorage = (key: string) => {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error("Error removing from localStorage:", error);
  }
};

// ============= IMAGE COMPRESSION TO FIT SIZE LIMIT =============
const TARGET_MAX_SIZE_BYTES = 1 * 1024 * 1024; // 1MB target

export const compressImageToFitSize = async (
  file: File,
  maxSizeBytes: number = TARGET_MAX_SIZE_BYTES
): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const reader = new FileReader();
    
    reader.onload = () => {
      img.onload = () => {
        let quality = 0.9;
        let maxWidth = img.width;
        const minWidth = 400; // Don't go below this
        const minQuality = 0.5;
        
        const tryCompress = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('Canvas context not available'));
            return;
          }
          
          // Calculate dimensions maintaining aspect ratio
          const ratio = img.height / img.width;
          canvas.width = maxWidth;
          canvas.height = Math.round(maxWidth * ratio);
          
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          
          const base64 = canvas.toDataURL('image/jpeg', quality);
          const sizeBytes = Math.round((base64.length - 22) * 0.75); // Approximate base64 to bytes
          
          console.log(`🖼️ Compression attempt: ${maxWidth}px, quality ${quality.toFixed(2)}, ~${(sizeBytes / 1024 / 1024).toFixed(2)}MB`);
          
          if (sizeBytes <= maxSizeBytes) {
            resolve(base64);
          } else if (quality > minQuality) {
            // First reduce quality
            quality -= 0.1;
            tryCompress();
          } else if (maxWidth > minWidth) {
            // Then reduce resolution
            quality = 0.8;
            maxWidth = Math.round(maxWidth * 0.7);
            tryCompress();
          } else {
            // Accept what we have at minimum settings
            console.log('⚠️ Could not compress below target, using minimum settings');
            resolve(base64);
          }
        };
        
        tryCompress();
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = reader.result as string;
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
};

// ============= BROWSER FEATURE DETECTION =============
export const checkBrowserCompatibility = (): { compatible: boolean; issues: string[] } => {
  const issues: string[] = [];
  
  // Check for Blob support
  if (typeof Blob === 'undefined') {
    issues.push("Blob API nicht unterstützt");
  }
  
  // Check for fetch support
  if (typeof fetch === 'undefined') {
    issues.push("Fetch API nicht unterstützt");
  }
  
  // Check for AbortController support
  if (typeof AbortController === 'undefined') {
    issues.push("AbortController nicht unterstützt");
  }
  
  // Check for URL.createObjectURL support
  if (typeof URL === 'undefined' || typeof URL.createObjectURL !== 'function') {
    issues.push("URL.createObjectURL nicht unterstützt");
  }
  
  return {
    compatible: issues.length === 0,
    issues
  };
};

// ============= DEVICE INFO FOR ERROR REPORTING =============
export const getDeviceInfo = (): string => {
  try {
    const nav = navigator as any;
    const memory = nav.deviceMemory ? `${nav.deviceMemory}GB RAM` : "RAM unbekannt";
    const connection = nav.connection?.effectiveType || "Verbindung unbekannt";
    
    // Simplified browser detection
    let browser = "Unbekannt";
    const ua = navigator.userAgent;
    if (ua.includes("Firefox")) browser = "Firefox";
    else if (ua.includes("Edg")) browser = "Edge";
    else if (ua.includes("Chrome")) browser = "Chrome";
    else if (ua.includes("Safari")) browser = "Safari";
    
    return `${browser}, ${memory}, ${connection}`;
  } catch (e) {
    return "Gerät unbekannt";
  }
};

// ============= DETAILED ERROR MESSAGE HELPER =============
export const getDetailedErrorMessage = (error: any): string => {
  if (!error) return "Google konnte deine Anfrage nicht verarbeiten. Bitte versuche es erneut.";
  
  const errorName = error?.name || "";
  const errorMessage = error?.message || String(error);
  
  // Timeout errors
  if (errorName === 'AbortError' || errorMessage.includes('timed out') || errorMessage.includes('timeout')) {
    return "Timeout: Google konnte deine Anfrage nicht rechtzeitig bearbeiten. Bitte versuche es erneut.";
  }
  
  // Network errors
  if (errorMessage.includes('Failed to fetch') || errorMessage.includes('network') || errorMessage.includes('Network')) {
    return "Verbindung zu Google unterbrochen - bitte pruefe deine Internetverbindung.";
  }
  
  // Memory errors
  if (errorMessage.includes('memory') || errorMessage.includes('Memory') || errorMessage.includes('RAM')) {
    return "Speicherfehler auf deinem Geraet - bitte schliesse andere Tabs.";
  }
  
  // Quota errors
  if (errorName === 'QuotaExceededError' || errorMessage.includes('quota')) {
    return "Lokaler Speicher voll - bitte Cache leeren.";
  }
  
  // Safety / content filter errors
  if (errorMessage.includes('SAFETY') || errorMessage.includes('safety') || errorMessage.includes('blockiert') || errorMessage.includes('IMAGE_OTHER')) {
    return "Google hat deinen Inhalt aus Sicherheitsgruenden abgelehnt. Bitte aendere deinen Prompt oder dein Referenzbild.";
  }
  
  // API status errors
  if (errorMessage.includes('429') || errorMessage.includes('Too Many') || errorMessage.includes('rate limit')) {
    return "Google-Server ueberlastet - bitte warte einen Moment und versuche es erneut.";
  }
  if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('Unauthorized')) {
    return "Dein API-Key wurde von Google abgelehnt - bitte pruefe ihn.";
  }
  if (errorMessage.includes('403') || errorMessage.includes('Forbidden')) {
    return "Google hat den Zugriff verweigert - pruefe deinen API-Key.";
  }
  if (errorMessage.includes('503') || errorMessage.includes('overloaded') || errorMessage.includes('Service Unavailable')) {
    return "Google-Server momentan ueberlastet - bitte spaeter erneut versuchen.";
  }
  if (errorMessage.includes('500') || errorMessage.includes('Internal Server')) {
    return "Interner Fehler bei Google - bitte versuche es erneut.";
  }
  if (errorMessage.includes('400') || errorMessage.includes('Bad Request')) {
    return "Google konnte deine Anfrage nicht verarbeiten - versuche deinen Prompt zu aendern.";
  }
  
  // Generic
  return `Google konnte deine Anfrage nicht verarbeiten: ${errorMessage}`;
};

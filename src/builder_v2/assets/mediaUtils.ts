/**
 * Image upload utility for the funnel builder
 * Uploads images to Supabase storage and returns the public URL
 */

import { supabase } from '@/integrations/supabase/client';

const BUCKET_NAME = 'funnel-images';

/**
 * Upload an image file to Supabase storage
 * @param file - The file to upload
 * @param teamId - Team ID for organizing files
 * @returns The public URL of the uploaded image
 */
export async function uploadImage(file: File, teamId: string): Promise<string> {
  // Generate a unique filename
  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const timestamp = Date.now();
  const randomId = Math.random().toString(36).substring(2, 8);
  const fileName = `${teamId}/${timestamp}-${randomId}.${ext}`;

  // Upload to Supabase storage
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(fileName, file, {
      cacheControl: '31536000', // 1 year cache
      upsert: false,
    });

  if (error) {
    console.error('Image upload error:', error);
    throw new Error(`Failed to upload image: ${error.message}`);
  }

  // Get the public URL
  const { data: publicUrlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

/**
 * Upload an image from a URL (for external images)
 * @param url - The image URL to fetch and upload
 * @param teamId - Team ID for organizing files
 * @returns The public URL of the uploaded image
 */
export async function uploadImageFromUrl(url: string, teamId: string): Promise<string> {
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch image');
    
    const blob = await response.blob();
    const ext = url.split('.').pop()?.split('?')[0] || 'jpg';
    const file = new File([blob], `imported.${ext}`, { type: blob.type });
    
    return uploadImage(file, teamId);
  } catch (error) {
    console.error('Failed to upload image from URL:', error);
    throw error;
  }
}

/**
 * Validate if a URL is a valid image URL
 */
export function isValidImageUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    const ext = parsed.pathname.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext || '');
  } catch {
    return false;
  }
}

/**
 * Normalize video embed URLs to proper embed format
 */
export function normalizeVideoUrl(url: string): string {
  if (!url) return '';
  
  try {
    const parsed = new URL(url);
    
    // YouTube
    if (parsed.hostname.includes('youtube.com') || parsed.hostname.includes('youtu.be')) {
      let videoId = '';
      
      if (parsed.hostname.includes('youtu.be')) {
        videoId = parsed.pathname.slice(1);
      } else if (parsed.searchParams.has('v')) {
        videoId = parsed.searchParams.get('v') || '';
      } else if (parsed.pathname.includes('/embed/')) {
        videoId = parsed.pathname.split('/embed/')[1];
      }
      
      if (videoId) {
        return `https://www.youtube.com/embed/${videoId}`;
      }
    }
    
    // Vimeo
    if (parsed.hostname.includes('vimeo.com')) {
      const videoId = parsed.pathname.split('/').pop();
      if (videoId && /^\d+$/.test(videoId)) {
        return `https://player.vimeo.com/video/${videoId}`;
      }
    }
    
    // Loom
    if (parsed.hostname.includes('loom.com')) {
      const shareMatch = parsed.pathname.match(/\/share\/([a-zA-Z0-9]+)/);
      if (shareMatch) {
        return `https://www.loom.com/embed/${shareMatch[1]}`;
      }
    }
    
    // Wistia
    if (parsed.hostname.includes('wistia.com') || parsed.hostname.includes('wi.st')) {
      const idMatch = parsed.pathname.match(/\/medias\/([a-zA-Z0-9]+)/);
      if (idMatch) {
        return `https://fast.wistia.net/embed/iframe/${idMatch[1]}`;
      }
    }
    
    return url;
  } catch {
    return url;
  }
}

/**
 * Check if a URL is a valid video embed URL
 */
export function isValidVideoUrl(url: string): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname.includes('youtube.com') ||
      parsed.hostname.includes('youtu.be') ||
      parsed.hostname.includes('vimeo.com') ||
      parsed.hostname.includes('loom.com') ||
      parsed.hostname.includes('wistia.com') ||
      parsed.hostname.includes('wi.st')
    );
  } catch {
    return false;
  }
}

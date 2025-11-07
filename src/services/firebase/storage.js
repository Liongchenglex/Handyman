/**
 * Firebase Storage Service
 *
 * Handles file uploads and downloads for the Handyman platform
 * Includes image compression and validation
 */

import {
  ref,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll
} from 'firebase/storage';
import { storage } from './config';

/**
 * Upload a file to Firebase Storage
 *
 * @param {File} file - The file to upload
 * @param {string} path - Storage path (e.g., 'handymen/profile-images/userId')
 * @param {Function} onProgress - Optional progress callback
 * @returns {Promise<string>} Download URL of uploaded file
 */
export const uploadFile = async (file, path, onProgress = null) => {
  try {
    if (!file) {
      throw new Error('No file provided');
    }

    // Validate file size (max 5MB)
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    if (file.size > MAX_FILE_SIZE) {
      throw new Error('File size exceeds 5MB limit');
    }

    const storageRef = ref(storage, path);

    // If progress callback is provided, use resumable upload
    if (onProgress) {
      const uploadTask = uploadBytesResumable(storageRef, file);

      return new Promise((resolve, reject) => {
        uploadTask.on(
          'state_changed',
          (snapshot) => {
            const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
            onProgress(progress);
          },
          (error) => {
            console.error('Upload error:', error);
            reject(error);
          },
          async () => {
            try {
              const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
              resolve(downloadURL);
            } catch (error) {
              reject(error);
            }
          }
        );
      });
    } else {
      // Simple upload without progress tracking
      const snapshot = await uploadBytes(storageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);
      return downloadURL;
    }
  } catch (error) {
    console.error('Error uploading file:', error);
    throw error;
  }
};

/**
 * Upload an image with compression
 *
 * @param {File} imageFile - The image file to upload
 * @param {string} path - Storage path
 * @param {Object} options - Compression options
 * @returns {Promise<string>} Download URL of uploaded image
 */
export const uploadImage = async (imageFile, path, options = {}) => {
  try {
    const {
      maxWidth = 1200,
      maxHeight = 1200,
      quality = 0.8
    } = options;

    // Validate file type
    if (!imageFile.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Create a canvas to compress the image
    const compressedImage = await compressImage(imageFile, maxWidth, maxHeight, quality);

    // Upload the compressed image
    return await uploadFile(compressedImage, path);
  } catch (error) {
    console.error('Error uploading image:', error);
    throw error;
  }
};

/**
 * Compress an image using canvas
 *
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Maximum width
 * @param {number} maxHeight - Maximum height
 * @param {number} quality - Image quality (0-1)
 * @returns {Promise<Blob>} Compressed image blob
 */
const compressImage = (file, maxWidth, maxHeight, quality) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // Calculate new dimensions
        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve(blob);
            } else {
              reject(new Error('Canvas to Blob conversion failed'));
            }
          },
          file.type,
          quality
        );
      };

      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
  });
};

/**
 * Delete a file from Firebase Storage
 *
 * @param {string} path - Storage path of file to delete
 * @returns {Promise<void>}
 */
export const deleteFile = async (path) => {
  try {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  } catch (error) {
    console.error('Error deleting file:', error);
    throw error;
  }
};

/**
 * Get download URL for a file
 *
 * @param {string} path - Storage path
 * @returns {Promise<string>} Download URL
 */
export const getFileURL = async (path) => {
  try {
    const storageRef = ref(storage, path);
    return await getDownloadURL(storageRef);
  } catch (error) {
    console.error('Error getting file URL:', error);
    throw error;
  }
};

/**
 * List all files in a directory
 *
 * @param {string} path - Storage directory path
 * @returns {Promise<Array>} Array of file references
 */
export const listFiles = async (path) => {
  try {
    const storageRef = ref(storage, path);
    const result = await listAll(storageRef);
    return result.items;
  } catch (error) {
    console.error('Error listing files:', error);
    throw error;
  }
};

export default storage;

import ImageKit from "@imagekit/nodejs";
import { IMAGEKIT_PRIVATE_KEY, IMAGEKIT_URL_ENDPOINT } from '../../shared/config/config.js';

// Initialize ImageKit with Private Key (Public Key and Endpoint are used in helpers)
const imagekit = new ImageKit({
    privateKey: IMAGEKIT_PRIVATE_KEY
});

/**
 * Uploads an image to ImageKit.
 * @param {string|Buffer} file - Base64 string, Buffer, or Stream.
 * @param {string} fileName - File name.
 * @param {string} folder - Destination folder (e.g., 'avatars', 'banners').
 * @returns {Promise<Object>} - Upload result from ImageKit.
 */
export const uploadToImageKit = async (file, fileName, folder = 'uploads') => {
    try {
        const response = await imagekit.files.upload({
            file: file,
            fileName: fileName,
            folder: folder,
            useUniqueFileName: true
        });
        return response;
    } catch (error) {
        console.error("❌ [ImageKit Service] Upload Error:", error);
        throw error;
    }
};

/**
 * Generates a transformed URL for an image.
 * @param {string} path - Path to the image in ImageKit (e.g., '/avatars/my_id.jpg').
 * @param {Array} transformations - ImageKit transformation options array.
 * @returns {string} - Transformed URL.
 */
export const getTransformedUrl = (path, transformations = []) => {
    return imagekit.helper.buildSrc({
        urlEndpoint: IMAGEKIT_URL_ENDPOINT,
        src: path,
        transformation: transformations
    });
};

/**
 * Deletes an image from ImageKit by its path.
 * @param {string} filePath - The path to the file in ImageKit (e.g., '/reels/my_reel.mp4').
 */
export const deleteFromImageKitByPath = async (filePath) => {
    try {
        const searchPath = filePath.startsWith('/') ? filePath : `/${filePath}`;
        
        // Find the file by path
        const files = await imagekit.assets.list({
            path: searchPath
        });

        if (files && files.length > 0) {
            const fileId = files[0].fileId;
            await imagekit.files.delete(fileId);
            console.log(`🗑️ [ImageKit] Deleted file at path ${searchPath} (ID: ${fileId})`);
        } else {
            console.warn(`⚠️ [ImageKit] No file found at path: ${searchPath}`);
        }
    } catch (error) {
        console.error("❌ [ImageKit Service] Delete By Path Error:", error);
    }
};

export default imagekit;

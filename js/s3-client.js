/**
 * S3 Client
 * Handles S3 operations for fetching screenshots
 */

class S3Client {
    constructor() {
        this.s3 = null;
        this.imageCache = new Map();
    }

    /**
     * Initialize S3 client
     */
    initialize() {
        if (!window.awsConfigManager.isConfigured) {
            throw new Error('AWS not configured');
        }
        
        this.s3 = new AWS.S3();
    }

    /**
     * Get signed URL for an S3 object
     */
    getSignedUrl(s3Key, expiresInSeconds = 3600) {
        if (!this.s3) {
            throw new Error('S3 client not initialized');
        }

        const config = window.awsConfigManager.getConfig();
        
        const params = {
            Bucket: config.bucketName,
            Key: s3Key,
            Expires: expiresInSeconds
        };

        try {
            return this.s3.getSignedUrl('getObject', params);
        } catch (error) {
            console.error('Error generating signed URL:', error);
            throw error;
        }
    }

    /**
     * Fetch image and return as blob URL
     */
    async fetchImage(s3Key) {
        // Check cache first
        if (this.imageCache.has(s3Key)) {
            return this.imageCache.get(s3Key);
        }

        try {
            const signedUrl = this.getSignedUrl(s3Key);
            
            // Fetch the image
            const response = await fetch(signedUrl);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const blobUrl = URL.createObjectURL(blob);
            
            // Cache the blob URL
            this.imageCache.set(s3Key, blobUrl);
            
            return blobUrl;
        } catch (error) {
            console.error('Error fetching image from S3:', error);
            throw error;
        }
    }

    /**
     * Load image and return as Image object
     */
    async loadImage(s3Key) {
        const blobUrl = await this.fetchImage(s3Key);
        
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error('Failed to load image'));
            
            img.src = blobUrl;
        });
    }

    /**
     * Preload multiple images
     */
    async preloadImages(s3Keys) {
        const promises = s3Keys.map(key => 
            this.fetchImage(key).catch(err => {
                console.warn(`Failed to preload ${key}:`, err);
                return null;
            })
        );
        
        return Promise.all(promises);
    }

    /**
     * Clear image cache
     */
    clearCache() {
        // Revoke all blob URLs to free memory
        for (const blobUrl of this.imageCache.values()) {
            URL.revokeObjectURL(blobUrl);
        }
        
        this.imageCache.clear();
    }

    /**
     * Check if object exists in S3
     */
    async objectExists(s3Key) {
        if (!this.s3) {
            throw new Error('S3 client not initialized');
        }

        const config = window.awsConfigManager.getConfig();
        
        try {
            await this.s3.headObject({
                Bucket: config.bucketName,
                Key: s3Key
            }).promise();
            
            return true;
        } catch (error) {
            if (error.code === 'NotFound' || error.statusCode === 404) {
                return false;
            }
            throw error;
        }
    }

    /**
     * Get object metadata
     */
    async getObjectMetadata(s3Key) {
        if (!this.s3) {
            throw new Error('S3 client not initialized');
        }

        const config = window.awsConfigManager.getConfig();
        
        try {
            const data = await this.s3.headObject({
                Bucket: config.bucketName,
                Key: s3Key
            }).promise();
            
            return {
                contentType: data.ContentType,
                contentLength: data.ContentLength,
                lastModified: data.LastModified,
                etag: data.ETag
            };
        } catch (error) {
            console.error('Error getting object metadata:', error);
            throw error;
        }
    }
}

// Global instance
window.s3Client = new S3Client();

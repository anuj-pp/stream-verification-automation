/**
 * AWS Configuration Manager
 * Handles AWS credentials configuration and validation
 */

class AWSConfigManager {
    constructor() {
        this.credentials = null;
        this.bucketName = null;
        this.region = 'eu-west-1';
        this.isConfigured = false;
    }

    /**
     * Configure AWS credentials
     */
    configure(accessKeyId, secretAccessKey, sessionToken, bucketName, region) {
        // Clean up session token - AWS SDK doesn't like empty strings
        const cleanSessionToken = sessionToken && sessionToken.trim() !== '' 
            ? sessionToken.trim() 
            : undefined;

        this.credentials = {
            accessKeyId: accessKeyId.trim(),
            secretAccessKey: secretAccessKey.trim(),
            sessionToken: cleanSessionToken,
        };
        this.bucketName = bucketName.trim();
        this.region = region.trim();

        // Configure AWS SDK - only set sessionToken if it exists
        const awsConfig = {
            accessKeyId: this.credentials.accessKeyId,
            secretAccessKey: this.credentials.secretAccessKey,
            region: this.region
        };

        if (cleanSessionToken) {
            awsConfig.sessionToken = cleanSessionToken;
        }

        AWS.config.update(awsConfig);

        this.isConfigured = true;
    }

    /**
     * Parse credentials from export format
     * Example:
     * export AWS_ACCESS_KEY_ID="YOUR_ACCESS_KEY_ID"
     * export AWS_SECRET_ACCESS_KEY="YOUR_SECRET_ACCESS_KEY"
     * export AWS_SESSION_TOKEN="YOUR_SESSION_TOKEN"
     */
    parseExportFormat(text) {
        const result = {
            accessKeyId: '',
            secretAccessKey: '',
            sessionToken: ''
        };

        // Match export statements with quotes
        const accessKeyMatch = text.match(/AWS_ACCESS_KEY_ID\s*=\s*["']([^"']+)["']/);
        const secretKeyMatch = text.match(/AWS_SECRET_ACCESS_KEY\s*=\s*["']([^"']+)["']/);
        const sessionTokenMatch = text.match(/AWS_SESSION_TOKEN\s*=\s*["']([^"']*)["']/);

        if (accessKeyMatch) {
            result.accessKeyId = accessKeyMatch[1];
        }
        if (secretKeyMatch) {
            result.secretAccessKey = secretKeyMatch[1];
        }
        if (sessionTokenMatch) {
            result.sessionToken = sessionTokenMatch[1];
        }

        return result;
    }

    /**
     * Validate credentials by attempting to list bucket
     */
    async validateCredentials() {
        if (!this.isConfigured) {
            throw new Error('AWS credentials not configured');
        }

        try {
            const s3 = new AWS.S3();
            
            console.log('Validating credentials for bucket:', this.bucketName, 'in region:', this.region);
            console.log('Using session token:', this.credentials.sessionToken ? 'Yes' : 'No');
            
            // Try to head bucket (lightweight check)
            await s3.headBucket({ Bucket: this.bucketName }).promise();
            
            console.log('✓ Credentials validated successfully');
            
            return {
                valid: true,
                message: 'Credentials validated successfully'
            };
        } catch (error) {
            console.error('Credential validation error:', error);
            console.error('Error code:', error.code);
            console.error('Error message:', error.message);
            
            let message = 'Invalid credentials or bucket access denied';
            let details = error.message;
            
            if (error.code === 'NoSuchBucket') {
                message = `Bucket '${this.bucketName}' does not exist`;
                details = 'Verify the bucket name and region are correct';
            } else if (error.code === 'InvalidAccessKeyId') {
                message = 'Invalid AWS Access Key ID';
                details = 'Check that the access key ID is correct';
            } else if (error.code === 'SignatureDoesNotMatch') {
                message = 'Invalid AWS Secret Access Key';
                details = 'Check that the secret access key is correct';
            } else if (error.code === 'AccessDenied' || error.code === 'Forbidden') {
                message = 'Access denied to bucket';
                details = 'Your credentials lack s3:HeadBucket permission';
            } else if (error.code === 'ExpiredToken') {
                message = 'Session token has expired';
                details = 'Generate new SSO credentials';
            } else if (error.code === 'NetworkingError' || error.message.includes('CORS')) {
                message = 'Network or CORS error';
                details = 'This may be a browser CORS issue when testing locally. Try: python3 -m http.server 8080';
            }
            
            return {
                valid: false,
                message: message,
                details: details,
                error: error
            };
        }
    }

    /**
     * Get current configuration
     */
    getConfig() {
        return {
            bucketName: this.bucketName,
            region: this.region,
            isConfigured: this.isConfigured
        };
    }

    /**
     * Clear credentials
     */
    clear() {
        this.credentials = null;
        this.bucketName = null;
        this.isConfigured = false;
        AWS.config.credentials = null;
    }

    /**
     * Save credentials to localStorage (optional, for convenience)
     */
    saveToLocalStorage() {
        if (!this.isConfigured) return;
        
        const config = {
            bucketName: this.bucketName,
            region: this.region
        };
        
        localStorage.setItem('aws_config', JSON.stringify(config));
    }

    /**
     * Load bucket and region from localStorage (without credentials)
     */
    loadFromLocalStorage() {
        try {
            const saved = localStorage.getItem('aws_config');
            if (saved) {
                const config = JSON.parse(saved);
                return {
                    bucketName: config.bucketName || 'streameranalytics-staging',
                    region: config.region || 'eu-west-1'
                };
            }
        } catch (error) {
            console.error('Error loading config from localStorage:', error);
        }
        
        return {
            bucketName: 'streameranalytics-staging',
            region: 'eu-west-1'
        };
    }
}

// Global instance
window.awsConfigManager = new AWSConfigManager();

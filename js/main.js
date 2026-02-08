/**
 * Main Application
 * Initializes the app and wires up event handlers
 */

(function() {
    'use strict';

    // Application state
    const appState = {
        credentialsValidated: false,
        jsonLoaded: false,
        sessionData: null
    };

    /**
     * Initialize application
     */
    function init() {
        console.log('Initializing S3 Screenshot Debugger...');

        // Load saved config from localStorage
        loadSavedConfig();

        // Setup event listeners
        setupCredentialHandlers();
        setupFileUploadHandlers();
        setupNavigationHandlers();
        setupFilterHandlers();
        setupKeyboardShortcuts();

        console.log('Application initialized');
    }

    /**
     * Load saved configuration
     */
    function loadSavedConfig() {
        const saved = window.awsConfigManager.loadFromLocalStorage();
        
        if (saved.bucketName) {
            document.getElementById('s3BucketName').value = saved.bucketName;
        }
        if (saved.region) {
            document.getElementById('awsRegion').value = saved.region;
        }
    }

    /**
     * Setup credential handlers
     */
    function setupCredentialHandlers() {
        const validateBtn = document.getElementById('validateCredentialsBtn');
        const toggleBtn = document.getElementById('toggleCredentialsBtn');
        const statusEl = document.getElementById('credentialStatus');
        const parseExportBtn = document.getElementById('parseExportBtn');
        const exportFormatPaste = document.getElementById('exportFormatPaste');

        // Parse export format
        parseExportBtn.addEventListener('click', () => {
            const text = exportFormatPaste.value;
            
            if (!text.trim()) {
                alert('Please paste your AWS credentials in export format');
                return;
            }

            try {
                const parsed = window.awsConfigManager.parseExportFormat(text);
                
                if (!parsed.accessKeyId || !parsed.secretAccessKey) {
                    alert('Could not parse credentials. Make sure the format is:\nexport AWS_ACCESS_KEY_ID="..."\nexport AWS_SECRET_ACCESS_KEY="..."\nexport AWS_SESSION_TOKEN="..."');
                    return;
                }

                // Fill the fields
                document.getElementById('awsAccessKeyId').value = parsed.accessKeyId;
                document.getElementById('awsSecretAccessKey').value = parsed.secretAccessKey;
                document.getElementById('awsSessionToken').value = parsed.sessionToken || '';

                // Clear the textarea
                exportFormatPaste.value = '';

                // Show success message
                alert('✓ Credentials parsed successfully!\nNow click "Validate Credentials"');
                
                // Close the details section
                const details = exportFormatPaste.closest('details');
                if (details) {
                    details.open = false;
                }
            } catch (error) {
                console.error('Error parsing credentials:', error);
                alert('Error parsing credentials: ' + error.message);
            }
        });

        validateBtn.addEventListener('click', async () => {
            const accessKeyId = document.getElementById('awsAccessKeyId').value;
            const secretAccessKey = document.getElementById('awsSecretAccessKey').value;
            const sessionToken = document.getElementById('awsSessionToken').value;
            const bucketName = document.getElementById('s3BucketName').value;
            const region = document.getElementById('awsRegion').value;

            if (!accessKeyId || !secretAccessKey || !bucketName || !region) {
                alert('Please fill in all required fields (Access Key, Secret Key, Bucket Name, Region)');
                return;
            }

            validateBtn.disabled = true;
            validateBtn.textContent = 'Validating...';
            statusEl.textContent = '';

            try {
                // Configure AWS
                window.awsConfigManager.configure(
                    accessKeyId,
                    secretAccessKey,
                    sessionToken,
                    bucketName,
                    region
                );

                // Validate credentials
                const result = await window.awsConfigManager.validateCredentials();

                if (result.valid) {
                    statusEl.textContent = '✓ Valid';
                    statusEl.className = 'credential-status valid';
                    statusEl.title = result.message;
                    appState.credentialsValidated = true;

                    // Initialize S3 client
                    window.s3Client.initialize();

                    // Save config to localStorage
                    window.awsConfigManager.saveToLocalStorage();

                    // Enable file upload
                    updateUIState();
                } else {
                    statusEl.textContent = '✗ ' + result.message;
                    statusEl.className = 'credential-status invalid';
                    statusEl.title = result.details || result.message;
                    appState.credentialsValidated = false;

                    // Show detailed error in console
                    console.error('Validation failed:', result);
                    if (result.details) {
                        console.error('Details:', result.details);
                    }
                }
            } catch (error) {
                console.error('Validation error:', error);
                statusEl.textContent = '✗ Error: ' + error.message;
                statusEl.className = 'credential-status invalid';
                appState.credentialsValidated = false;
            } finally {
                validateBtn.disabled = false;
                validateBtn.textContent = 'Validate Credentials';
            }
        });

        // Toggle credentials visibility
        toggleBtn.addEventListener('click', () => {
            const inputs = ['awsAccessKeyId', 'awsSecretAccessKey', 'awsSessionToken'];
            inputs.forEach(id => {
                const input = document.getElementById(id);
                input.type = input.type === 'password' ? 'text' : 'password';
            });
        });
    }

    /**
     * Setup file upload handlers
     */
    function setupFileUploadHandlers() {
        const fileInput = document.getElementById('jsonFile');
        const loadBtn = document.getElementById('loadJsonBtn');
        const fileInfoEl = document.getElementById('fileInfo');

        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            
            if (file) {
                fileInfoEl.textContent = `Selected: ${file.name} (${formatFileSize(file.size)})`;
                
                if (appState.credentialsValidated) {
                    loadBtn.disabled = false;
                }
            } else {
                fileInfoEl.textContent = '';
                loadBtn.disabled = true;
            }
        });

        loadBtn.addEventListener('click', async () => {
            const file = fileInput.files[0];
            
            if (!file) {
                alert('Please select a JSON file');
                return;
            }

            if (!appState.credentialsValidated) {
                alert('Please validate AWS credentials first');
                return;
            }

            loadBtn.disabled = true;
            loadBtn.textContent = 'Loading...';

            try {
                // Parse JSON file
                const data = await window.jsonParser.parseFile(file);

                console.log('Parsed data:', data);

                appState.jsonLoaded = true;
                appState.sessionData = data;

                // Display session info
                displaySessionInfo(data.metadata);

                // Load results into viewer
                window.screenshotViewer.loadResults(data.results);

                // Update UI state
                updateUIState();

                // Scroll to viewer
                document.getElementById('viewerSection').scrollIntoView({ behavior: 'smooth' });

            } catch (error) {
                console.error('Error loading JSON:', error);
                alert('Error loading JSON file: ' + error.message);
                appState.jsonLoaded = false;
            } finally {
                loadBtn.disabled = false;
                loadBtn.textContent = 'Load Analysis';
            }
        });
    }

    /**
     * Display session information
     */
    function displaySessionInfo(metadata) {
        document.getElementById('infoPlatform').textContent = metadata.platform;
        document.getElementById('infoChannel').textContent = metadata.channel;
        document.getElementById('infoDate').textContent = metadata.date;
        document.getElementById('infoSessionId').textContent = metadata.sessionId;
        document.getElementById('infoTotal').textContent = metadata.total;
        
        const stats = window.jsonParser.getDiscrepancyStats();
        document.getElementById('infoDiscrepancies').textContent = 
            `${stats.withDiscrepancies} / ${stats.total}`;
        
        document.getElementById('infoAnalyzedAt').textContent = 
            window.discrepancyManager.formatTimestamp(metadata.analyzedAt);

        document.getElementById('sessionInfo').style.display = 'block';
    }

    /**
     * Setup navigation handlers
     */
    function setupNavigationHandlers() {
        document.getElementById('prevBtn').addEventListener('click', () => {
            window.screenshotViewer.previous();
        });

        document.getElementById('nextBtn').addEventListener('click', () => {
            window.screenshotViewer.next();
        });

        document.getElementById('firstBtn').addEventListener('click', () => {
            window.screenshotViewer.first();
        });

        document.getElementById('lastBtn').addEventListener('click', () => {
            window.screenshotViewer.last();
        });

        document.getElementById('jumpBtn').addEventListener('click', () => {
            const input = document.getElementById('jumpToIndex');
            const index = parseInt(input.value);

            if (isNaN(index)) {
                alert('Please enter a valid index number');
                return;
            }

            const success = window.screenshotViewer.jumpTo(index);
            
            if (!success) {
                alert(`Index ${index} not found in current filter`);
            }
        });

        // Jump on Enter key
        document.getElementById('jumpToIndex').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                document.getElementById('jumpBtn').click();
            }
        });

        // Bounding boxes toggle
        document.getElementById('showBoundingBoxes').addEventListener('change', (e) => {
            window.screenshotViewer.toggleBoundingBoxes(e.target.checked);
        });
    }

    /**
     * Setup filter handlers
     */
    function setupFilterHandlers() {
        document.getElementById('filterDiscrepancies').addEventListener('change', (e) => {
            window.screenshotViewer.updateFilter('onlyDiscrepancies', e.target.checked);
        });

        document.getElementById('filterMlVsPost').addEventListener('change', (e) => {
            window.screenshotViewer.updateFilter('mlVsPost', e.target.checked);
        });

        document.getElementById('filterPostVsDb').addEventListener('change', (e) => {
            window.screenshotViewer.updateFilter('postVsDb', e.target.checked);
        });

        document.getElementById('filterMissingInDb').addEventListener('change', (e) => {
            window.screenshotViewer.updateFilter('missingInDb', e.target.checked);
        });

        document.getElementById('filterExtraInDb').addEventListener('change', (e) => {
            window.screenshotViewer.updateFilter('extraInDb', e.target.checked);
        });

        document.getElementById('clearFiltersBtn').addEventListener('click', () => {
            // Clear all filter checkboxes
            ['filterDiscrepancies', 'filterMlVsPost', 'filterPostVsDb', 'filterMissingInDb', 'filterExtraInDb']
                .forEach(id => {
                    document.getElementById(id).checked = false;
                });

            window.screenshotViewer.clearFilters();
        });

        document.getElementById('exportBtn').addEventListener('click', () => {
            exportResults();
        });

        document.getElementById('highlightDiscrepancies').addEventListener('change', (e) => {
            // This would update timeline highlighting
            window.screenshotViewer.renderTimeline();
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!appState.jsonLoaded) return;

            // Ignore if typing in input field
            if (e.target.tagName === 'INPUT') return;

            switch(e.key) {
                case 'ArrowLeft':
                    e.preventDefault();
                    window.screenshotViewer.previous();
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    window.screenshotViewer.next();
                    break;
                case 'Home':
                    e.preventDefault();
                    window.screenshotViewer.first();
                    break;
                case 'End':
                    e.preventDefault();
                    window.screenshotViewer.last();
                    break;
                case 'b':
                case 'B':
                    e.preventDefault();
                    const checkbox = document.getElementById('showBoundingBoxes');
                    checkbox.checked = !checkbox.checked;
                    window.screenshotViewer.toggleBoundingBoxes(checkbox.checked);
                    break;
            }
        });
    }

    /**
     * Update UI state based on app state
     */
    function updateUIState() {
        const loadBtn = document.getElementById('loadJsonBtn');
        
        if (appState.credentialsValidated && document.getElementById('jsonFile').files.length > 0) {
            loadBtn.disabled = false;
        }

        if (appState.jsonLoaded) {
            document.getElementById('filters').style.display = 'block';
            document.getElementById('viewerSection').style.display = 'block';
        }
    }

    /**
     * Export results as CSV
     */
    function exportResults() {
        if (!appState.jsonLoaded) {
            alert('No data to export');
            return;
        }

        const csv = window.jsonParser.exportAsCSV();
        const metadata = window.jsonParser.getMetadata();
        const filename = `analysis_export_${metadata.sessionId}_${Date.now()}.csv`;

        downloadTextFile(csv, filename, 'text/csv');
    }

    /**
     * Download text file
     */
    function downloadTextFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    /**
     * Format file size
     */
    function formatFileSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }

    // Initialize on DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();

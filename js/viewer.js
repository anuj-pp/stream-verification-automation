/**
 * Screenshot Viewer
 * Handles screenshot display, navigation, and timeline
 */

class ScreenshotViewer {
    constructor() {
        this.results = [];
        this.filteredResults = [];
        this.currentIndex = 0;
        this.filterCriteria = {
            onlyDiscrepancies: false,
            mlVsPost: false,
            postVsDb: false,
            missingInDb: false,
            extraInDb: false
        };
        this.showBoundingBoxes = false;
    }

    /**
     * Load results into viewer
     */
    loadResults(results) {
        this.results = results;
        this.applyFilters();
        this.currentIndex = 0;
        this.renderTimeline();
        this.displayCurrent();
    }

    /**
     * Apply filters to results
     */
    applyFilters() {
        this.filteredResults = window.jsonParser.filterResults(this.filterCriteria);

        // If no results match filters, show all
        if (this.filteredResults.length === 0 && this.results.length > 0) {
            this.filteredResults = this.results;
        }

        // Reset to first if current index is out of bounds
        if (this.currentIndex >= this.filteredResults.length) {
            this.currentIndex = 0;
        }
    }

    /**
     * Display current screenshot and data
     */
    async displayCurrent() {
        if (this.filteredResults.length === 0) {
            console.warn('No results to display');
            return;
        }

        const result = this.filteredResults[this.currentIndex];

        // Update counter
        this.updateCounter();

        // Update screenshot metadata
        this.updateScreenshotMetadata(result);

        // Load and display screenshot
        await this.displayScreenshot(result.screenshot, result.mlInference);

        // Display comparison data
        window.comparisonDisplay.displayResult(result);

        // Display discrepancies
        const discrepancies = window.discrepancyManager.analyzeResult(result);
        window.discrepancyManager.renderDiscrepancyAlert(discrepancies);

        // Update timeline highlight
        this.updateTimelineHighlight();

        // Update navigation buttons
        this.updateNavigationButtons();
    }

    /**
     * Display screenshot with optional bounding boxes
     */
    async displayScreenshot(screenshot, mlInference) {
        const canvas = document.getElementById('screenshotCanvas');
        const ctx = canvas.getContext('2d');
        const loader = document.getElementById('imageLoader');

        if (!screenshot || !screenshot.s3Key) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#666';
            ctx.font = '16px sans-serif';
            ctx.fillText('No screenshot available', 10, 30);
            return;
        }

        try {
            loader.style.display = 'block';

            // Load image from S3
            const img = await window.s3Client.loadImage(screenshot.s3Key);

            // Set canvas size to match image
            canvas.width = img.width;
            canvas.height = img.height;

            // Draw image
            ctx.drawImage(img, 0, 0);

            // Draw bounding boxes if enabled
            if (this.showBoundingBoxes && mlInference?.games) {
                this.drawBoundingBoxes(ctx, mlInference.games, canvas.width, canvas.height);
            }

            loader.style.display = 'none';
        } catch (error) {
            console.error('Error loading screenshot:', error);
            loader.style.display = 'none';

            // Display error on canvas
            ctx.fillStyle = '#333';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.fillStyle = '#f00';
            ctx.font = '16px sans-serif';
            ctx.fillText('Error loading screenshot', 10, 30);
            ctx.fillStyle = '#999';
            ctx.font = '12px sans-serif';
            ctx.fillText(error.message, 10, 50);
        }
    }

    /**
     * Draw bounding boxes on canvas
     */
    drawBoundingBoxes(ctx, games, canvasWidth, canvasHeight) {
        const colors = ['#4a9eff', '#6b5ce7', '#22c55e', '#f59e0b', '#ef4444'];

        games.forEach((game, index) => {
            if (!game.box || game.box.length !== 4) return;

            const [x1, y1, x2, y2] = game.box;
            const color = colors[index % colors.length];

            // Draw rectangle
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);

            // Draw label background
            const label = game.class;
            ctx.font = '14px sans-serif';
            const textWidth = ctx.measureText(label).width;
            ctx.fillStyle = color;
            ctx.fillRect(x1, y1 - 22, textWidth + 10, 20);

            // Draw label text
            ctx.fillStyle = '#fff';
            ctx.fillText(label, x1 + 5, y1 - 6);
        });
    }

    /**
     * Update screenshot metadata display
     */
    updateScreenshotMetadata(result) {
        const screenshot = result.screenshot;

        document.getElementById('screenshotTimestamp').textContent = 
            window.discrepancyManager.formatTimestamp(screenshot?.timestamp);
        document.getElementById('screenshotFilename').textContent = 
            screenshot?.filename || 'N/A';
        document.getElementById('screenshotIndex').textContent = 
            result.index;
    }

    /**
     * Update counter display
     */
    updateCounter() {
        document.getElementById('currentIndex').textContent = this.currentIndex + 1;
        document.getElementById('totalCount').textContent = this.filteredResults.length;
    }

    /**
     * Navigate to next screenshot
     */
    next() {
        if (this.currentIndex < this.filteredResults.length - 1) {
            this.currentIndex++;
            this.displayCurrent();
        }
    }

    /**
     * Navigate to previous screenshot
     */
    previous() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.displayCurrent();
        }
    }

    /**
     * Navigate to first screenshot
     */
    first() {
        this.currentIndex = 0;
        this.displayCurrent();
    }

    /**
     * Navigate to last screenshot
     */
    last() {
        this.currentIndex = this.filteredResults.length - 1;
        this.displayCurrent();
    }

    /**
     * Jump to specific index
     */
    jumpTo(index) {
        // Find the result with this index in filtered results
        const resultIndex = this.filteredResults.findIndex(r => r.index === index);
        
        if (resultIndex !== -1) {
            this.currentIndex = resultIndex;
            this.displayCurrent();
            return true;
        }
        
        return false;
    }

    /**
     * Update navigation buttons state
     */
    updateNavigationButtons() {
        const prevBtn = document.getElementById('prevBtn');
        const firstBtn = document.getElementById('firstBtn');
        const nextBtn = document.getElementById('nextBtn');
        const lastBtn = document.getElementById('lastBtn');

        prevBtn.disabled = this.currentIndex === 0;
        firstBtn.disabled = this.currentIndex === 0;
        nextBtn.disabled = this.currentIndex >= this.filteredResults.length - 1;
        lastBtn.disabled = this.currentIndex >= this.filteredResults.length - 1;
    }

    /**
     * Render timeline
     */
    renderTimeline() {
        const trackEl = document.getElementById('timelineTrack');
        trackEl.innerHTML = '';

        this.filteredResults.forEach((result, index) => {
            const item = document.createElement('div');
            item.className = 'timeline-item';
            
            if (result.hasDiscrepancy) {
                item.classList.add('discrepancy');
            } else {
                item.classList.add('match');
            }

            if (index === this.currentIndex) {
                item.classList.add('current');
            }

            item.title = `Index ${result.index}: ${result.screenshot?.timestamp || 'N/A'}`;
            item.addEventListener('click', () => {
                this.currentIndex = index;
                this.displayCurrent();
            });

            trackEl.appendChild(item);
        });
    }

    /**
     * Update timeline highlight
     */
    updateTimelineHighlight() {
        const items = document.querySelectorAll('.timeline-item');
        items.forEach((item, index) => {
            if (index === this.currentIndex) {
                item.classList.add('current');
            } else {
                item.classList.remove('current');
            }
        });
    }

    /**
     * Toggle bounding boxes
     */
    toggleBoundingBoxes(enabled) {
        this.showBoundingBoxes = enabled;
        this.displayCurrent();
    }

    /**
     * Update filter
     */
    updateFilter(filterName, enabled) {
        this.filterCriteria[filterName] = enabled;
        this.applyFilters();
        this.renderTimeline();
        this.displayCurrent();
    }

    /**
     * Clear all filters
     */
    clearFilters() {
        this.filterCriteria = {
            onlyDiscrepancies: false,
            mlVsPost: false,
            postVsDb: false,
            missingInDb: false,
            extraInDb: false
        };
        this.applyFilters();
        this.renderTimeline();
        this.displayCurrent();
    }

    /**
     * Get current result
     */
    getCurrentResult() {
        return this.filteredResults[this.currentIndex];
    }

    /**
     * Preload adjacent screenshots
     */
    async preloadAdjacent() {
        const toPreload = [];

        // Preload next 3 and previous 1
        for (let i = -1; i <= 3; i++) {
            const index = this.currentIndex + i;
            if (index >= 0 && index < this.filteredResults.length && index !== this.currentIndex) {
                const result = this.filteredResults[index];
                if (result.screenshot?.s3Key) {
                    toPreload.push(result.screenshot.s3Key);
                }
            }
        }

        if (toPreload.length > 0) {
            window.s3Client.preloadImages(toPreload).catch(err => {
                console.warn('Error preloading images:', err);
            });
        }
    }
}

// Global instance
window.screenshotViewer = new ScreenshotViewer();

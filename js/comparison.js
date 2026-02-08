/**
 * Comparison Display
 * Renders side-by-side comparison of ML, Post-Processing, and DB data
 */

class ComparisonDisplay {
    constructor() {
        this.currentResult = null;
    }

    /**
     * Display comparison for a result
     */
    displayResult(result) {
        this.currentResult = result;

        this.displayMLInference(result.mlInference);
        this.displayPostProcessed(result.postProcessed);
        this.displayDatabase(result.dbSessions, result.dbGameCounts);

        // Update status badges
        this.updateStatusBadges(result);
    }

    /**
     * Display ML Inference results
     */
    displayMLInference(mlInference) {
        const contentDiv = document.getElementById('mlContent');

        if (!mlInference || mlInference.error) {
            contentDiv.innerHTML = `<div class="empty-state">Error: ${mlInference?.error || 'No data'}</div>`;
            return;
        }

        if (mlInference.numberOfGames === 0) {
            contentDiv.innerHTML = `
                <div class="empty-state">No games detected</div>
                <div class="game-item">
                    <div class="game-details">
                        <div class="detail-row">
                            <span class="detail-label">Latency:</span>
                            <span class="detail-value">${mlInference.latencyMs.toFixed(2)} ms</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Uniform Frame:</span>
                            <span class="detail-value">${mlInference.isUniformFrame ? 'Yes' : 'No'}</span>
                        </div>
                    </div>
                </div>
            `;
            return;
        }

        let html = `
            <div style="margin-bottom: 15px; padding: 10px; background: var(--bg-tertiary); border-radius: 4px;">
                <strong>Total Games:</strong> ${mlInference.numberOfGames} | 
                <strong>Latency:</strong> ${mlInference.latencyMs.toFixed(2)} ms
            </div>
        `;

        mlInference.games.forEach((game, index) => {
            html += `
                <div class="game-item">
                    <div class="game-header">Game ${index + 1}: ${game.class}</div>
                    <div class="game-details">
                        <div class="detail-row">
                            <span class="detail-label">Game ID:</span>
                            <span class="detail-value">${game.class}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Confidence:</span>
                            <span class="detail-value">${game.confidence.toFixed(4)}</span>
                        </div>
                        ${game.box ? `
                        <div class="detail-row">
                            <span class="detail-label">Bounding Box:</span>
                            <span class="detail-value" style="font-size: 0.85rem;">
                                [${game.box.map(v => v.toFixed(1)).join(', ')}]
                            </span>
                        </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        contentDiv.innerHTML = html;
    }

    /**
     * Display Post-Processed results
     */
    displayPostProcessed(postProcessed) {
        const contentDiv = document.getElementById('postContent');

        if (!postProcessed || postProcessed.error) {
            contentDiv.innerHTML = `<div class="empty-state">Error: ${postProcessed?.error || 'No data'}</div>`;
            return;
        }

        if (postProcessed.gameCount === 0) {
            contentDiv.innerHTML = `
                <div class="empty-state">No games after post-processing</div>
                <div class="game-item">
                    <div class="game-details">
                        <div class="detail-row">
                            <span class="detail-label">Event Type:</span>
                            <span class="detail-value">${postProcessed.eventType}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Threshold Applied:</span>
                            <span class="detail-value">${postProcessed.appliedThreshold ? 'Yes' : 'No'}</span>
                        </div>
                    </div>
                    ${this.renderSlidingWindow(postProcessed.slidingWindowState)}
                </div>
            `;
            return;
        }

        let html = `
            <div style="margin-bottom: 15px; padding: 10px; background: var(--bg-tertiary); border-radius: 4px;">
                <strong>Game Count:</strong> ${postProcessed.gameCount} | 
                <strong>Event:</strong> ${postProcessed.eventType}
            </div>
        `;

        postProcessed.games.forEach((game, index) => {
            html += `
                <div class="game-item">
                    <div class="game-header">Game ${index + 1}: ${game.gameId}</div>
                    <div class="game-details">
                        <div class="detail-row">
                            <span class="detail-label">Game ID:</span>
                            <span class="detail-value">${game.gameId}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Session ID:</span>
                            <span class="detail-value" style="font-size: 0.85rem;">${game.gameSessionId}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        html += this.renderSlidingWindow(postProcessed.slidingWindowState);

        contentDiv.innerHTML = html;
    }

    /**
     * Render sliding window state
     */
    renderSlidingWindow(windowState) {
        if (!windowState || windowState.length === 0) {
            return '';
        }

        let html = '<div class="sliding-window">';
        html += '<h4>Sliding Window State</h4>';
        html += '<div class="sliding-window-items">';

        windowState.forEach(gameId => {
            html += `<div class="sliding-window-item">${gameId}</div>`;
        });

        html += '</div></div>';
        return html;
    }

    /**
     * Display Database results
     */
    displayDatabase(dbSessions, dbGameCounts) {
        const contentDiv = document.getElementById('dbContent');

        if (!dbSessions || dbSessions.length === 0) {
            contentDiv.innerHTML = '<div class="empty-state">No database sessions found</div>';
            return;
        }

        let html = `
            <div style="margin-bottom: 15px; padding: 10px; background: var(--bg-tertiary); border-radius: 4px;">
                <strong>DB Sessions:</strong> ${dbSessions.length}
                ${dbGameCounts && dbGameCounts.length > 0 ? ` | <strong>Game Counts:</strong> ${dbGameCounts.length}` : ''}
            </div>
        `;

        // Display sessions
        dbSessions.forEach((session, index) => {
            const airtimeFormatted = window.discrepancyManager.formatAirtime(session.trueAirtime);
            const matchIcon = session.matchesScreenshot ? '✓' : '✗';

            html += `
                <div class="game-item">
                    <div class="game-header">
                        ${session.gameName || session.gameIdentifier}
                        <span style="float: right; font-size: 0.9rem;">${matchIcon}</span>
                    </div>
                    <div class="game-details">
                        <div class="detail-row">
                            <span class="detail-label">Game ID:</span>
                            <span class="detail-value">${session.gameIdentifier}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Session ID:</span>
                            <span class="detail-value" style="font-size: 0.85rem;">${session.gameSessionId}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">True Airtime:</span>
                            <span class="detail-value">
                                <span class="airtime-highlight">${airtimeFormatted} (${session.trueAirtime}s)</span>
                            </span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">Start:</span>
                            <span class="detail-value" style="font-size: 0.85rem;">${this.formatTime(session.startTime)}</span>
                        </div>
                        <div class="detail-row">
                            <span class="detail-label">End:</span>
                            <span class="detail-value" style="font-size: 0.85rem;">${this.formatTime(session.endTime)}</span>
                        </div>
                    </div>
                </div>
            `;
        });

        // Display game counts if available
        if (dbGameCounts && dbGameCounts.length > 0) {
            html += '<div style="margin-top: 15px; padding: 10px; background: var(--bg-primary); border-radius: 4px;">';
            html += '<h4 style="margin-bottom: 10px; color: var(--text-secondary); font-size: 0.9rem;">Game Count Records</h4>';
            
            dbGameCounts.forEach(count => {
                html += `
                    <div style="margin-bottom: 5px; font-size: 0.85rem; color: var(--text-secondary);">
                        ${this.formatTime(count.timestamp)} - ${count.gameIdentifier}
                    </div>
                `;
            });
            
            html += '</div>';
        }

        contentDiv.innerHTML = html;
    }

    /**
     * Update status badges
     */
    updateStatusBadges(result) {
        // ML Status
        const mlBadge = window.discrepancyManager.getStatusBadge(
            result.mlInference?.numberOfGames > 0,
            result.mlInference?.error,
            result.discrepancyFlags.ml_vs_postprocessing
        );
        const mlStatusEl = document.getElementById('mlStatus');
        mlStatusEl.textContent = mlBadge.text;
        mlStatusEl.className = `status-badge ${mlBadge.class}`;

        // Post-Processing Status
        const postBadge = window.discrepancyManager.getStatusBadge(
            result.postProcessed?.gameCount > 0,
            result.postProcessed?.error,
            result.discrepancyFlags.ml_vs_postprocessing || result.discrepancyFlags.postprocessing_vs_db
        );
        const postStatusEl = document.getElementById('postStatus');
        postStatusEl.textContent = postBadge.text;
        postStatusEl.className = `status-badge ${postBadge.class}`;

        // Database Status
        const dbBadge = window.discrepancyManager.getStatusBadge(
            result.dbSessions?.length > 0,
            false,
            result.discrepancyFlags.postprocessing_vs_db || result.discrepancyFlags.missing_in_db || result.discrepancyFlags.extra_in_db
        );
        const dbStatusEl = document.getElementById('dbStatus');
        dbStatusEl.textContent = dbBadge.text;
        dbStatusEl.className = `status-badge ${dbBadge.class}`;
    }

    /**
     * Format time
     */
    formatTime(timestamp) {
        if (!timestamp) return 'N/A';

        try {
            const date = new Date(timestamp);
            return date.toLocaleString('en-US', {
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false
            });
        } catch (error) {
            return timestamp;
        }
    }

    /**
     * Clear all displays
     */
    clear() {
        document.getElementById('mlContent').innerHTML = '';
        document.getElementById('postContent').innerHTML = '';
        document.getElementById('dbContent').innerHTML = '';
        
        ['mlStatus', 'postStatus', 'dbStatus'].forEach(id => {
            const el = document.getElementById(id);
            el.textContent = '';
            el.className = 'status-badge';
        });
    }
}

// Global instance
window.comparisonDisplay = new ComparisonDisplay();

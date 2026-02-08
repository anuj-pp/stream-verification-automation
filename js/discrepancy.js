/**
 * Discrepancy Manager
 * Handles discrepancy detection, highlighting, and display
 */

class DiscrepancyManager {
    constructor() {
        this.currentResult = null;
    }

    /**
     * Analyze result for discrepancies
     */
    analyzeResult(result) {
        this.currentResult = result;

        const discrepancies = [];

        if (result.discrepancyFlags.ml_vs_postprocessing) {
            discrepancies.push(this.analyzeMlVsPost(result));
        }

        if (result.discrepancyFlags.postprocessing_vs_db) {
            discrepancies.push(this.analyzePostVsDb(result));
        }

        if (result.discrepancyFlags.missing_in_db) {
            discrepancies.push(this.analyzeMissingInDb(result));
        }

        if (result.discrepancyFlags.extra_in_db) {
            discrepancies.push(this.analyzeExtraInDb(result));
        }

        return discrepancies;
    }

    /**
     * Analyze ML vs Post-Processing discrepancy
     */
    analyzeMlVsPost(result) {
        const mlGames = result.mlInference?.numberOfGames || 0;
        const postGames = result.postProcessed?.gameCount || 0;

        let description = '';
        let severity = 'warning';

        if (mlGames > postGames) {
            description = `ML detected ${mlGames} game(s), but post-processing filtered down to ${postGames}. This is normal for sliding window logic building up threshold.`;
            severity = 'info';
        } else if (mlGames < postGames) {
            description = `ML detected ${mlGames} game(s), but post-processing returned ${postGames}. This should not happen!`;
            severity = 'error';
        } else {
            description = `ML and post-processing both show ${mlGames} games, but with different game IDs.`;
            severity = 'warning';
        }

        return {
            type: 'ml-vs-post',
            title: 'ML API vs Post-Processing Mismatch',
            description: description,
            severity: severity,
            details: {
                mlGames: result.mlInference?.games || [],
                postGames: result.postProcessed?.games || [],
                slidingWindowState: result.postProcessed?.slidingWindowState || []
            }
        };
    }

    /**
     * Analyze Post-Processing vs DB discrepancy
     */
    analyzePostVsDb(result) {
        const postGames = result.postProcessed?.gameCount || 0;
        const dbSessions = result.dbSessions?.length || 0;

        const description = `Post-processing shows ${postGames} game(s), but database has ${dbSessions} session(s). This indicates a DB write issue.`;

        return {
            type: 'post-vs-db',
            title: 'Post-Processing vs Database Mismatch',
            description: description,
            severity: 'error',
            details: {
                postGames: result.postProcessed?.games || [],
                dbSessions: result.dbSessions || []
            }
        };
    }

    /**
     * Analyze Missing in DB discrepancy
     */
    analyzeMissingInDb(result) {
        const postGames = result.postProcessed?.games || [];
        const dbSessionIds = new Set((result.dbSessions || []).map(s => s.gameSessionId));

        const missingGames = postGames.filter(game => !dbSessionIds.has(game.gameSessionId));

        const description = `${missingGames.length} game(s) from post-processing are missing in the database.`;

        return {
            type: 'missing-in-db',
            title: 'Games Missing in Database',
            description: description,
            severity: 'error',
            details: {
                missingGames: missingGames,
                expectedCount: postGames.length,
                actualCount: result.dbSessions?.length || 0
            }
        };
    }

    /**
     * Analyze Extra in DB discrepancy
     */
    analyzeExtraInDb(result) {
        const postGameIds = new Set((result.postProcessed?.games || []).map(g => g.gameSessionId));
        const extraSessions = (result.dbSessions || []).filter(s => !postGameIds.has(s.gameSessionId));

        const description = `${extraSessions.length} session(s) in database that were not in post-processing output.`;

        return {
            type: 'extra-in-db',
            title: 'Extra Sessions in Database',
            description: description,
            severity: 'warning',
            details: {
                extraSessions: extraSessions
            }
        };
    }

    /**
     * Render discrepancy alert
     */
    renderDiscrepancyAlert(discrepancies) {
        const alertDiv = document.getElementById('discrepancyAlert');
        const detailsDiv = document.getElementById('discrepancyDetails');

        if (!discrepancies || discrepancies.length === 0) {
            alertDiv.style.display = 'none';
            return;
        }

        let html = '';

        discrepancies.forEach(disc => {
            const severityClass = `discrepancy-type ${disc.type}`;
            
            html += `
                <div class="discrepancy-item">
                    <div class="${severityClass}">${disc.title}</div>
                    <p>${disc.description}</p>
                    ${this.renderDiscrepancyDetails(disc)}
                </div>
            `;
        });

        detailsDiv.innerHTML = html;
        alertDiv.style.display = 'block';
    }

    /**
     * Render discrepancy details
     */
    renderDiscrepancyDetails(discrepancy) {
        let html = '<div style="margin-top: 10px; font-size: 0.9rem;">';

        if (discrepancy.type === 'ml-vs-post') {
            if (discrepancy.details.slidingWindowState.length > 0) {
                html += `<div><strong>Sliding Window:</strong> ${discrepancy.details.slidingWindowState.join(', ')}</div>`;
            }
        }

        if (discrepancy.type === 'missing-in-db' && discrepancy.details.missingGames.length > 0) {
            html += '<div><strong>Missing Games:</strong></div><ul style="margin-left: 20px;">';
            discrepancy.details.missingGames.forEach(game => {
                html += `<li>${game.gameId} (${game.gameSessionId})</li>`;
            });
            html += '</ul>';
        }

        if (discrepancy.type === 'extra-in-db' && discrepancy.details.extraSessions.length > 0) {
            html += '<div><strong>Extra Sessions:</strong></div><ul style="margin-left: 20px;">';
            discrepancy.details.extraSessions.forEach(session => {
                html += `<li>${session.gameName || session.gameIdentifier} (${session.gameSessionId})</li>`;
            });
            html += '</ul>';
        }

        html += '</div>';
        return html;
    }

    /**
     * Get status badge info based on discrepancies
     */
    getStatusBadge(hasData, hasError, hasDiscrepancy) {
        if (hasError) {
            return { text: 'Error', class: 'error' };
        }
        if (hasDiscrepancy) {
            return { text: 'Mismatch', class: 'warning' };
        }
        if (hasData) {
            return { text: 'OK', class: 'success' };
        }
        return { text: 'Empty', class: '' };
    }

    /**
     * Compare game lists
     */
    compareGameLists(list1, list2, key1 = 'gameId', key2 = 'gameId') {
        const ids1 = new Set(list1.map(item => item[key1]));
        const ids2 = new Set(list2.map(item => item[key2]));

        const inFirst = list1.filter(item => !ids2.has(item[key1]));
        const inSecond = list2.filter(item => !ids1.has(item[key2]));
        const inBoth = list1.filter(item => ids2.has(item[key1]));

        return {
            onlyInFirst: inFirst,
            onlyInSecond: inSecond,
            inBoth: inBoth,
            match: inFirst.length === 0 && inSecond.length === 0
        };
    }

    /**
     * Format airtime (seconds to human readable)
     */
    formatAirtime(seconds) {
        if (!seconds) return '0s';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        const parts = [];
        if (hours > 0) parts.push(`${hours}h`);
        if (minutes > 0) parts.push(`${minutes}m`);
        if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

        return parts.join(' ');
    }

    /**
     * Format timestamp
     */
    formatTimestamp(timestamp) {
        if (!timestamp) return 'N/A';

        try {
            const date = new Date(timestamp);
            return date.toLocaleString();
        } catch (error) {
            return timestamp;
        }
    }
}

// Global instance
window.discrepancyManager = new DiscrepancyManager();

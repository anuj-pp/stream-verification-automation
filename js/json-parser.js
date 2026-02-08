/**
 * JSON Parser
 * Parses and validates complete_analysis.json files
 */

class JSONParser {
    constructor() {
        this.analysisData = null;
        this.sessionMetadata = null;
        this.results = [];
        this.discrepancyCount = 0;
    }

    /**
     * Parse JSON file
     */
    async parseFile(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();

            reader.onload = (e) => {
                try {
                    const jsonData = JSON.parse(e.target.result);
                    this.validateAndParse(jsonData);
                    resolve({
                        metadata: this.sessionMetadata,
                        results: this.results,
                        discrepancyCount: this.discrepancyCount
                    });
                } catch (error) {
                    reject(new Error(`JSON parsing error: ${error.message}`));
                }
            };

            reader.onerror = () => {
                reject(new Error('Failed to read file'));
            };

            reader.readAsText(file);
        });
    }

    /**
     * Validate and parse JSON data
     */
    validateAndParse(data) {
        // Validate required fields
        if (!data.session_id) {
            throw new Error('Missing required field: session_id');
        }
        if (!data.results || !Array.isArray(data.results)) {
            throw new Error('Missing or invalid results array');
        }

        // Extract session metadata
        this.sessionMetadata = {
            sessionId: data.session_id,
            platform: data.platform || 'unknown',
            channel: data.channel || 'unknown',
            date: data.date || 'unknown',
            startTime: data.start_time || null,
            endTime: data.end_time || null,
            analyzedAt: data.analyzed_at || null,
            total: data.total || data.results.length
        };

        // Parse results
        this.results = data.results.map(result => this.parseResult(result));

        // Count discrepancies
        this.discrepancyCount = this.results.filter(r => r.hasDiscrepancy).length;

        this.analysisData = data;
    }

    /**
     * Parse individual result entry
     */
    parseResult(result) {
        const parsed = {
            index: result.index,
            screenshot: this.parseScreenshot(result.screenshot),
            mlInference: this.parseMLInference(result.ml_inference),
            postProcessed: this.parsePostProcessed(result.post_processed),
            dbSessions: this.parseDBSessions(result.db_sessions),
            dbGameCounts: this.parseDBGameCounts(result.db_game_counts),
            discrepancyFlags: result.discrepancy_flags || {},
            hasDiscrepancy: this.hasAnyDiscrepancy(result.discrepancy_flags)
        };

        return parsed;
    }

    /**
     * Parse screenshot data
     */
    parseScreenshot(screenshot) {
        if (!screenshot) return null;

        return {
            filename: screenshot.filename,
            s3Key: screenshot.s3_key,
            timestamp: screenshot.timestamp,
            url: screenshot.url || null,
            cacheKey: screenshot.cache_key || null
        };
    }

    /**
     * Parse ML inference data
     */
    parseMLInference(mlInference) {
        if (!mlInference) return null;

        return {
            games: (mlInference.games || []).map(game => ({
                class: game.class,
                confidence: game.confidence,
                box: game.box || null
            })),
            numberOfGames: mlInference.number_of_games || 0,
            latencyMs: mlInference.latency_ms || 0,
            isUniformFrame: mlInference.is_uniform_frame || false,
            error: mlInference.error || null
        };
    }

    /**
     * Parse post-processed data
     */
    parsePostProcessed(postProcessed) {
        if (!postProcessed) return null;

        return {
            games: (postProcessed.games || []).map(game => ({
                gameId: game.game_id,
                gameSessionId: game.game_session_id
            })),
            gameCount: postProcessed.game_count || 0,
            eventType: postProcessed.event_type || 'UNKNOWN',
            appliedThreshold: postProcessed.applied_threshold || false,
            slidingWindowState: postProcessed.sliding_window_state || [],
            error: postProcessed.error || null
        };
    }

    /**
     * Parse database sessions
     */
    parseDBSessions(dbSessions) {
        if (!dbSessions || !Array.isArray(dbSessions)) return [];

        return dbSessions.map(session => ({
            gameSessionId: session.game_session_id,
            gameIdentifier: session.game_identifier,
            gameName: session.game_name || session.game_identifier,
            startTime: session.start_time,
            endTime: session.end_time,
            trueAirtime: session.true_airtime || 0,
            matchesScreenshot: session.matches_screenshot !== false
        }));
    }

    /**
     * Parse database game counts
     */
    parseDBGameCounts(dbGameCounts) {
        if (!dbGameCounts || !Array.isArray(dbGameCounts)) return [];

        return dbGameCounts.map(count => ({
            timestamp: count.timestamp,
            gameSessionId: count.game_session_id,
            gameIdentifier: count.game_identifier
        }));
    }

    /**
     * Check if result has any discrepancy
     */
    hasAnyDiscrepancy(flags) {
        if (!flags) return false;

        return flags.ml_vs_postprocessing ||
               flags.postprocessing_vs_db ||
               flags.missing_in_db ||
               flags.extra_in_db;
    }

    /**
     * Get result by index
     */
    getResult(index) {
        return this.results.find(r => r.index === index);
    }

    /**
     * Get all results
     */
    getAllResults() {
        return this.results;
    }

    /**
     * Get session metadata
     */
    getMetadata() {
        return this.sessionMetadata;
    }

    /**
     * Get discrepancy statistics
     */
    getDiscrepancyStats() {
        const stats = {
            total: this.results.length,
            withDiscrepancies: this.discrepancyCount,
            mlVsPostprocessing: 0,
            postprocessingVsDb: 0,
            missingInDb: 0,
            extraInDb: 0
        };

        this.results.forEach(result => {
            if (result.discrepancyFlags.ml_vs_postprocessing) {
                stats.mlVsPostprocessing++;
            }
            if (result.discrepancyFlags.postprocessing_vs_db) {
                stats.postprocessingVsDb++;
            }
            if (result.discrepancyFlags.missing_in_db) {
                stats.missingInDb++;
            }
            if (result.discrepancyFlags.extra_in_db) {
                stats.extraInDb++;
            }
        });

        return stats;
    }

    /**
     * Filter results by criteria
     */
    filterResults(criteria) {
        return this.results.filter(result => {
            if (criteria.onlyDiscrepancies && !result.hasDiscrepancy) {
                return false;
            }

            if (criteria.mlVsPost && !result.discrepancyFlags.ml_vs_postprocessing) {
                return false;
            }

            if (criteria.postVsDb && !result.discrepancyFlags.postprocessing_vs_db) {
                return false;
            }

            if (criteria.missingInDb && !result.discrepancyFlags.missing_in_db) {
                return false;
            }

            if (criteria.extraInDb && !result.discrepancyFlags.extra_in_db) {
                return false;
            }

            return true;
        });
    }

    /**
     * Export results as CSV
     */
    exportAsCSV() {
        const headers = [
            'Index',
            'Timestamp',
            'ML Games',
            'Post-Processed Games',
            'DB Sessions',
            'ML vs Post',
            'Post vs DB',
            'Missing in DB',
            'Extra in DB'
        ];

        const rows = this.results.map(result => [
            result.index,
            result.screenshot?.timestamp || '',
            result.mlInference?.numberOfGames || 0,
            result.postProcessed?.gameCount || 0,
            result.dbSessions?.length || 0,
            result.discrepancyFlags.ml_vs_postprocessing ? 'YES' : 'NO',
            result.discrepancyFlags.postprocessing_vs_db ? 'YES' : 'NO',
            result.discrepancyFlags.missing_in_db ? 'YES' : 'NO',
            result.discrepancyFlags.extra_in_db ? 'YES' : 'NO'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');

        return csvContent;
    }

    /**
     * Clear data
     */
    clear() {
        this.analysisData = null;
        this.sessionMetadata = null;
        this.results = [];
        this.discrepancyCount = 0;
    }
}

// Global instance
window.jsonParser = new JSONParser();

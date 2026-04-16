import { ANOMALY_THRESHOLD_PERCENT, ANOMALY_CRITICAL_PERCENT, ANOMALY_COMPARISON_WINDOW, ANOMALY_MIN_HISTORY } from '../config.js';
import { getPreviousObservations } from './observation-store.js';

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function getThreshold(metricName, queryThresholds, direction) {
  const metricThreshold = queryThresholds?.[metricName];
  if (metricThreshold) {
    if (direction === 'drop' && metricThreshold.dropPercent != null) {
      return metricThreshold.dropPercent;
    }
    if (direction === 'spike' && metricThreshold.spikePercent != null) {
      return metricThreshold.spikePercent;
    }
  }
  return ANOMALY_THRESHOLD_PERCENT;
}

/**
 * Detect anomalies for a set of metrics from a single query run.
 *
 * @param {string} queryUri - URI of the monitoring query
 * @param {string} queryName - Human-readable name of the query
 * @param {Array} metrics - Array of { metricName, value }
 * @param {Object} queryThresholds - Per-metric threshold overrides from sidecar config
 * @returns {Array} Array of anomaly objects
 */
export async function detectAnomalies(queryUri, queryName, metrics, queryThresholds = {}) {
  const anomalies = [];

  for (const { metricName, value } of metrics) {
    const previous = await getPreviousObservations(queryUri, metricName, ANOMALY_COMPARISON_WINDOW);

    if (previous.length < ANOMALY_MIN_HISTORY) {
      continue; // not enough history
    }

    const previousValues = previous.map(p => p.value);
    const baseline = median(previousValues);

    // Total loss
    if (value === 0 && baseline > 0) {
      anomalies.push({
        metricName,
        previousValue: Math.round(baseline),
        currentValue: value,
        changePercent: -100,
        severity: 'critical',
        description: `[${queryName}] ${metricName}: total loss — dropped from ${Math.round(baseline)} to 0`,
      });
      continue;
    }

    // Skip if baseline is 0 (avoid division by zero)
    if (baseline === 0) {
      continue;
    }

    const changePercent = ((value - baseline) / baseline) * 100;
    const absChange = Math.abs(changePercent);

    const direction = changePercent < 0 ? 'drop' : 'spike';
    const threshold = getThreshold(metricName, queryThresholds, direction);

    if (absChange > threshold) {
      const severity = absChange > ANOMALY_CRITICAL_PERCENT ? 'critical' : 'warning';
      const dirLabel = direction === 'drop' ? 'dropped' : 'spiked';
      anomalies.push({
        metricName,
        previousValue: Math.round(baseline),
        currentValue: value,
        changePercent: parseFloat(changePercent.toFixed(2)),
        severity,
        description: `[${queryName}] ${metricName}: ${dirLabel} by ${absChange.toFixed(1)}% (${Math.round(baseline)} → ${value})`,
      });
    }
  }

  return anomalies;
}

import { query as muQuery } from 'mu';
import { JOB_CREATOR_URI, JOB_OPERATION_URI, TASK_OPERATION_URI } from '../config.js';
import { STATUS_BUSY, STATUS_SUCCESS } from '../lib/constants.js';
import { createJob, failJob, succeedJob } from '../lib/job.js';
import { createTask } from '../lib/task.js';
import { createJobError } from '../lib/error.js';
import { updateStatus } from '../lib/utils.js';
import { loadMonitoringQueries } from '../lib/query-loader.js';
import { transformToCountQuery } from '../lib/query-transformer.js';
import { storeRun, storeObservations, storeAnomaly } from '../lib/observation-store.js';
import { detectAnomalies } from '../lib/anomaly-detector.js';
import { sendAnomalyAlert } from '../lib/alert.js';

export async function startMonitoringRun() {
  let jobUri;

  try {
    console.info('Starting monitoring run');
    jobUri = await createJob(JOB_OPERATION_URI, JOB_CREATOR_URI, STATUS_BUSY);
    const taskUri = await createTask(jobUri, '0', TASK_OPERATION_URI, STATUS_BUSY);

    const queries = await loadMonitoringQueries();

    if (!queries.length) {
      console.warn('No monitoring queries found');
      await updateStatus(taskUri, STATUS_SUCCESS);
      await succeedJob(jobUri);
      return;
    }

    const allAnomalies = [];

    for (const queryDef of queries) {
      try {
        console.info(`Processing query: ${queryDef.name}`);

        const { countQuery, optionalVariables } = transformToCountQuery(queryDef.parsedQuery);
        console.info(`Transformed query has ${optionalVariables.length} optional variables`);

        const result = await muQuery(countQuery);

        const row = result.results?.bindings?.[0];
        if (!row) {
          console.warn(`No results for query: ${queryDef.name}`);
          continue;
        }

        const metrics = [];
        if (row.totalRows) {
          metrics.push({
            metricName: 'totalRows',
            value: parseInt(row.totalRows.value),
          });
        }

        for (const varName of optionalVariables) {
          const key = `completeness_${varName}`;
          if (row[key]) {
            metrics.push({
              metricName: key,
              value: parseInt(row[key].value),
            });
          }
        }

        const runUri = await storeRun(jobUri, queryDef.uri);
        await storeObservations(runUri, queryDef.uri, metrics);

        const anomalies = await detectAnomalies(
          queryDef.uri,
          queryDef.name,
          metrics,
          queryDef.thresholds,
        );

        for (const anomaly of anomalies) {
          console.warn(`ANOMALY: ${anomaly.description}`);
          await storeAnomaly(runUri, queryDef.uri, anomaly);
          allAnomalies.push(anomaly);
        }

        console.info(`Query ${queryDef.name}: ${metrics.map(m => `${m.metricName}=${m.value}`).join(', ')}`);
      } catch (queryError) {
        console.error(`Error processing query ${queryDef.name}:`, queryError);
        await createJobError(taskUri, `Error in query "${queryDef.name}": ${queryError.message}`);
      }
    }

    if (allAnomalies.length) {
      console.warn(`Monitoring run completed with ${allAnomalies.length} anomalies`);
      await sendAnomalyAlert(jobUri, allAnomalies);
    } else {
      console.info('Monitoring run completed — no anomalies detected');
    }

    await updateStatus(taskUri, STATUS_SUCCESS);
    await succeedJob(jobUri);
  } catch (error) {
    console.error('Monitoring run failed:', error);
    if (jobUri) {
      await failJob(jobUri);
    }
  }
}

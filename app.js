import { app, errorHandler } from 'mu';
import { JOB_OPERATION_URI } from './config.js';
import { startMonitoringRun } from './pipeline/monitoring-run.js';

let running = false;

app.get('/', function (_req, res) {
  res.send('Hello, you have reached data-monitoring-service! I\'m doing just fine :)');
});

// Delta endpoint — triggered by scheduled-job-controller via delta-notifier
app.post('/delta', async function (req, res) {
  // Respond immediately so delta-notifier doesn't retry
  res.status(200).send();

  // Check if the delta contains a job creation for our operation
  const deltas = Array.isArray(req.body) ? req.body : [req.body].filter(Boolean);
  const isRelevant = deltas.some(delta => {
    const inserts = delta.inserts || [];
    return inserts.some(triple =>
      triple.predicate?.value === 'http://redpencil.data.gift/vocabularies/tasks/operation' &&
      triple.object?.value === JOB_OPERATION_URI
    );
  });

  if (!isRelevant) return;

  if (running) {
    console.info('Monitoring run already in progress, skipping');
    return;
  }

  running = true;
  try {
    await startMonitoringRun();
  } finally {
    running = false;
  }
});

// Manual trigger endpoint for debugging
app.post('/monitoring-runs', async function (_req, res) {
  if (running) {
    return res.status(409).send({ msg: 'Monitoring run already in progress' });
  }

  running = true;
  startMonitoringRun().finally(() => { running = false; });
  res.send({ msg: 'Started monitoring run' });
});

app.use(errorHandler);

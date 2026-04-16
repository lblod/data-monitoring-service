import { app, errorHandler } from 'mu';
import bodyParser from 'body-parser';
import { TASK_OPERATION_URI } from './config.js';
import { runMonitoringTask, runAdhocMonitoringRun } from './pipeline/monitoring-run.js';
import { Delta } from './lib/delta.js';

const TASK_OPERATION_PREDICATE = 'http://redpencil.data.gift/vocabularies/tasks/operation';
const DCT_IS_PART_OF = 'http://purl.org/dc/terms/isPartOf';

app.get('/', function (_req, res) {
  res.send('Hello, you have reached data-monitoring-service! I\'m doing just fine :)');
});

// Delta endpoint — triggered by delta-notifier when a scheduled task for this
// service is created by scheduled-job-controller. The template's default
// bodyParser only accepts application/vnd.api+json, so we attach a json
// bodyParser explicitly per the mu-javascript-template `add-delta-handler`
// convention.
app.post('/delta', bodyParser.json({ limit: '50mb' }), async function (req, res) {
  // Respond immediately so delta-notifier doesn't retry
  res.status(200).send();

  const delta = new Delta(req.body);
  const taskUris = delta.getInsertsFor(TASK_OPERATION_PREDICATE, TASK_OPERATION_URI);

  for (const taskUri of taskUris) {
    const jobUri = delta.getInsertObject(taskUri, DCT_IS_PART_OF);
    if (!jobUri) {
      console.warn(`Task ${taskUri} has no parent job in delta — skipping`);
      continue;
    }
    try {
      await runMonitoringTask(taskUri, jobUri);
    } catch (err) {
      console.error(`Monitoring run failed for task ${taskUri}:`, err);
    }
  }
});

// Manual trigger endpoint for debugging — creates a standalone job + task
app.post('/monitoring-runs', async function (_req, res) {
  runAdhocMonitoringRun().catch(err =>
    console.error('Ad-hoc monitoring run failed:', err)
  );
  res.send({ msg: 'Started ad-hoc monitoring run' });
});

app.use(errorHandler);

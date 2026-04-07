// JOBS & TASKS
export const JOB_URI_PREFIX = 'http://redpencil.data.gift/id/job/';
export const JOB_TYPE = 'http://vocab.deri.ie/cogs#Job';
export const TASK_URI_PREFIX = 'http://redpencil.data.gift/id/task/';
export const TASK_TYPE = 'http://redpencil.data.gift/vocabularies/tasks/Task';

// STATUS
export const STATUS_BUSY = 'http://redpencil.data.gift/id/concept/JobStatus/busy';
export const STATUS_SCHEDULED = 'http://redpencil.data.gift/id/concept/JobStatus/scheduled';
export const STATUS_FAILED = 'http://redpencil.data.gift/id/concept/JobStatus/failed';
export const STATUS_SUCCESS = 'http://redpencil.data.gift/id/concept/JobStatus/success';

// ERRORS
export const ERROR_TYPE = 'http://open-services.net/ns/core#Error';
export const ERROR_URI_PREFIX = 'http://redpencil.data.gift/id/jobs/error/';

// MONITORING
export const MONITORING_RUN_URI_PREFIX = 'http://lblod.data.gift/id/monitoring-run/';
export const MONITORING_RUN_TYPE = 'http://lblod.data.gift/vocabularies/monitoring/MonitoringRun';
export const MONITORING_QUERY_URI_PREFIX = 'http://lblod.data.gift/id/monitoring-query/';
export const MONITORING_QUERY_TYPE = 'http://lblod.data.gift/vocabularies/monitoring/MonitoringQuery';
export const OBSERVATION_URI_PREFIX = 'http://lblod.data.gift/id/observation/';
export const OBSERVATION_TYPE = 'http://lblod.data.gift/vocabularies/monitoring/Observation';
export const ANOMALY_URI_PREFIX = 'http://lblod.data.gift/id/anomaly/';
export const ANOMALY_TYPE = 'http://lblod.data.gift/vocabularies/monitoring/Anomaly';

// EMAIL
export const EMAIL_URI_PREFIX = 'http://data.lblod.info/id/emails/';

export const PREFIXES = `
  PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
  PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
  PREFIX dct: <http://purl.org/dc/terms/>
  PREFIX prov: <http://www.w3.org/ns/prov#>
  PREFIX ext: <http://mu.semte.ch/vocabularies/ext/>
  PREFIX oslc: <http://open-services.net/ns/core#>
  PREFIX cogs: <http://vocab.deri.ie/cogs#>
  PREFIX adms: <http://www.w3.org/ns/adms#>
  PREFIX nfo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#>
  PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
  PREFIX mon: <http://lblod.data.gift/vocabularies/monitoring/>
`;

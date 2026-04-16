import { update, sparqlEscapeDateTime, sparqlEscapeString, sparqlEscapeUri, uuid } from 'mu';
import { JOB_TYPE, JOB_URI_PREFIX, PREFIXES, STATUS_BUSY } from './constants.js';
import { JOBS_GRAPH } from '../config.js';

export async function createJob(jobOperationUri, jobCreator, status = STATUS_BUSY) {
  const jobId = uuid();
  const jobUri = JOB_URI_PREFIX + jobId;
  const created = new Date();
  await update(`
    ${PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)} {
        ${sparqlEscapeUri(jobUri)} a ${sparqlEscapeUri(JOB_TYPE)};
          mu:uuid ${sparqlEscapeString(jobId)};
          dct:creator ${sparqlEscapeUri(jobCreator)};
          adms:status ${sparqlEscapeUri(status)};
          dct:created ${sparqlEscapeDateTime(created)};
          dct:modified ${sparqlEscapeDateTime(created)};
          task:operation ${sparqlEscapeUri(jobOperationUri)}.
      }
    }
  `);
  return jobUri;
}

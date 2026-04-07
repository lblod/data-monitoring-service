import { update, sparqlEscapeDateTime, sparqlEscapeString, sparqlEscapeUri, uuid } from 'mu';
import {
  JOB_TYPE, JOB_URI_PREFIX, PREFIXES,
  STATUS_BUSY, STATUS_FAILED, STATUS_SUCCESS,
} from './constants.js';
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

export async function failJob(jobUri) {
  await update(`
    ${PREFIXES}
    DELETE {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)} {
        ?subject adms:status ?status .
        ?subject dct:modified ?modified .
      }
    }
    INSERT {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)} {
        ?subject adms:status ${sparqlEscapeUri(STATUS_FAILED)} .
        ?subject dct:modified ${sparqlEscapeDateTime(new Date())} .
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)} {
        VALUES ?subject { ${sparqlEscapeUri(jobUri)} }
        ?subject adms:status ?status .
        OPTIONAL { ?subject dct:modified ?modified . }
      }
    }
  `);
}

export async function succeedJob(jobUri) {
  await update(`
    ${PREFIXES}
    DELETE {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)} {
        ${sparqlEscapeUri(jobUri)} adms:status ?status .
        ${sparqlEscapeUri(jobUri)} dct:modified ?modified .
      }
    }
    INSERT {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)} {
        ${sparqlEscapeUri(jobUri)} adms:status ${sparqlEscapeUri(STATUS_SUCCESS)} .
        ${sparqlEscapeUri(jobUri)} dct:modified ${sparqlEscapeDateTime(new Date())} .
      }
    }
    WHERE {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)} {
        ${sparqlEscapeUri(jobUri)} adms:status ?status .
        OPTIONAL { ${sparqlEscapeUri(jobUri)} dct:modified ?modified . }
      }
    }
  `);
}

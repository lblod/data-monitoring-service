import { update, sparqlEscapeDateTime, sparqlEscapeString, sparqlEscapeUri, uuid } from 'mu';
import { PREFIXES, STATUS_SCHEDULED, TASK_TYPE, TASK_URI_PREFIX } from './constants.js';
import { JOBS_GRAPH } from '../config.js';

export async function createTask(job, index, operation, status = STATUS_SCHEDULED) {
  const id = uuid();
  const uri = TASK_URI_PREFIX + id;
  const created = new Date();
  await update(`
    ${PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)} {
        ${sparqlEscapeUri(uri)} a ${sparqlEscapeUri(TASK_TYPE)};
          mu:uuid ${sparqlEscapeString(id)};
          dct:isPartOf ${sparqlEscapeUri(job)};
          dct:created ${sparqlEscapeDateTime(created)};
          dct:modified ${sparqlEscapeDateTime(created)};
          adms:status ${sparqlEscapeUri(status)};
          task:index ${sparqlEscapeString(index)};
          task:operation ${sparqlEscapeUri(operation)}.
      }
    }
  `);
  return uri;
}

import { update, sparqlEscapeString, sparqlEscapeUri, uuid } from 'mu';
import { ERROR_TYPE, ERROR_URI_PREFIX, PREFIXES } from './constants.js';
import { JOBS_GRAPH } from '../config.js';

export async function createJobError(subject, errorMsg) {
  const id = uuid();
  const uri = ERROR_URI_PREFIX + id;
  await update(`
    ${PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(JOBS_GRAPH)} {
        ${sparqlEscapeUri(uri)}
          a ${sparqlEscapeUri(ERROR_TYPE)} ;
          mu:uuid ${sparqlEscapeString(id)} ;
          oslc:message ${sparqlEscapeString(errorMsg)} .
        ${sparqlEscapeUri(subject)} task:error ${sparqlEscapeUri(uri)} .
      }
    }
  `);
}

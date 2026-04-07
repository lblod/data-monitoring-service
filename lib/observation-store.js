import { query, update, sparqlEscapeDateTime, sparqlEscapeInt, sparqlEscapeString, sparqlEscapeUri, uuid } from 'mu';
import {
  PREFIXES,
  MONITORING_RUN_URI_PREFIX, MONITORING_RUN_TYPE,
  OBSERVATION_URI_PREFIX, OBSERVATION_TYPE,
  ANOMALY_URI_PREFIX, ANOMALY_TYPE,
} from './constants.js';
import { MONITORING_GRAPH } from '../config.js';
import { parseResult } from './utils.js';

export async function storeRun(jobUri, queryUri) {
  const id = uuid();
  const uri = MONITORING_RUN_URI_PREFIX + id;
  const created = new Date();
  await update(`
    ${PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(MONITORING_GRAPH)} {
        ${sparqlEscapeUri(uri)} a ${sparqlEscapeUri(MONITORING_RUN_TYPE)} ;
          mu:uuid ${sparqlEscapeString(id)} ;
          dct:created ${sparqlEscapeDateTime(created)} ;
          mon:forQuery ${sparqlEscapeUri(queryUri)} ;
          dct:isPartOf ${sparqlEscapeUri(jobUri)} .
      }
    }
  `);
  return uri;
}

export async function storeObservations(runUri, queryUri, metrics) {
  if (!metrics.length) return;

  const triples = metrics.map(({ metricName, value }) => {
    const id = uuid();
    const uri = OBSERVATION_URI_PREFIX + id;
    return `
      ${sparqlEscapeUri(uri)} a ${sparqlEscapeUri(OBSERVATION_TYPE)} ;
        mu:uuid ${sparqlEscapeString(id)} ;
        mon:partOfRun ${sparqlEscapeUri(runUri)} ;
        mon:forQuery ${sparqlEscapeUri(queryUri)} ;
        mon:metricName ${sparqlEscapeString(metricName)} ;
        mon:value ${sparqlEscapeInt(value)} .`;
  }).join('\n');

  await update(`
    ${PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(MONITORING_GRAPH)} {
        ${triples}
      }
    }
  `);
}

export async function getPreviousObservations(queryUri, metricName, limit) {
  const result = await query(`
    ${PREFIXES}
    SELECT ?value ?created WHERE {
      GRAPH ${sparqlEscapeUri(MONITORING_GRAPH)} {
        ?obs a ${sparqlEscapeUri(OBSERVATION_TYPE)} ;
          mon:forQuery ${sparqlEscapeUri(queryUri)} ;
          mon:metricName ${sparqlEscapeString(metricName)} ;
          mon:value ?value ;
          mon:partOfRun ?run .
        ?run dct:created ?created .
      }
    }
    ORDER BY DESC(?created)
    LIMIT ${limit}
  `);
  return parseResult(result);
}

export async function storeAnomaly(runUri, queryUri, anomaly) {
  const id = uuid();
  const uri = ANOMALY_URI_PREFIX + id;
  const created = new Date();
  await update(`
    ${PREFIXES}
    INSERT DATA {
      GRAPH ${sparqlEscapeUri(MONITORING_GRAPH)} {
        ${sparqlEscapeUri(uri)} a ${sparqlEscapeUri(ANOMALY_TYPE)} ;
          mu:uuid ${sparqlEscapeString(id)} ;
          mon:detectedInRun ${sparqlEscapeUri(runUri)} ;
          mon:forQuery ${sparqlEscapeUri(queryUri)} ;
          mon:metricName ${sparqlEscapeString(anomaly.metricName)} ;
          mon:previousValue ${sparqlEscapeInt(anomaly.previousValue)} ;
          mon:currentValue ${sparqlEscapeInt(anomaly.currentValue)} ;
          mon:changePercent "${anomaly.changePercent.toFixed(2)}"^^xsd:decimal ;
          mon:severity ${sparqlEscapeString(anomaly.severity)} ;
          dct:created ${sparqlEscapeDateTime(created)} ;
          dct:description ${sparqlEscapeString(anomaly.description)} .
      }
    }
  `);
  return uri;
}

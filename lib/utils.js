import { update, sparqlEscapeDateTime, sparqlEscapeUri } from 'mu';
import { PREFIXES } from './constants.js';

export async function updateStatus(subject, status) {
  const modified = new Date();
  const q = `
    ${PREFIXES}

    DELETE {
      GRAPH ?g {
        ?subject adms:status ?status;
          dct:modified ?modified .
      }
    }
    INSERT {
      GRAPH ?g {
        ?subject adms:status ${sparqlEscapeUri(status)};
          dct:modified ${sparqlEscapeDateTime(modified)}.
      }
    }
    WHERE {
      BIND(${sparqlEscapeUri(subject)} as ?subject)
      GRAPH ?g {
        ?subject adms:status ?status .
        OPTIONAL { ?subject dct:modified ?modified . }
      }
    }
  `;
  await update(q);
}

export function parseResult(result) {
  if (!(result.results && result.results.bindings.length)) return [];

  const bindingKeys = result.head.vars;
  return result.results.bindings.map((row) => {
    const obj = {};
    bindingKeys.forEach((key) => {
      if (row[key] && row[key].datatype == 'http://www.w3.org/2001/XMLSchema#integer' && row[key].value) {
        obj[key] = parseInt(row[key].value);
      }
      else if (row[key] && row[key].datatype == 'http://www.w3.org/2001/XMLSchema#dateTime' && row[key].value) {
        obj[key] = new Date(row[key].value);
      }
      else obj[key] = row[key] ? row[key].value : undefined;
    });
    return obj;
  });
}

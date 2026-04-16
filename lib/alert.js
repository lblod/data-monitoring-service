import { update, sparqlEscapeDateTime, sparqlEscapeString, sparqlEscapeUri, uuid } from 'mu';
import { EMAIL_URI_PREFIX } from './constants.js';
import { EMAIL_GRAPH, EMAIL_FOLDER_URI, JOB_CREATOR_URI } from '../config.js';

export async function sendAnomalyAlert(jobUri, anomalies) {
  const subject = `Data monitoring: ${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'} detected`;

  const rows = anomalies.map(a => {
    const icon = a.severity === 'critical' ? '!!' : '!';
    return `<tr>
      <td>${icon} ${a.severity}</td>
      <td>${escapeHtml(a.description)}</td>
    </tr>`;
  }).join('\n');

  const content = `<h2>Data Monitoring Alert</h2>
<p>${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'} detected at ${new Date().toISOString()}</p>
<table border="1" cellpadding="4" cellspacing="0">
  <tr><th>Severity</th><th>Description</th></tr>
  ${rows}
</table>`;

  await createEmail(jobUri, subject, content);
}

export async function sendFailureAlert(jobUri, error) {
  const subject = 'Data monitoring: run failed';
  const content = `<h2>Data Monitoring Failure</h2>
<p>The monitoring run failed at ${new Date().toISOString()}.</p>
<p><strong>Error:</strong> ${escapeHtml(error.message || String(error))}</p>
${error.stack ? `<pre>${escapeHtml(error.stack)}</pre>` : ''}`;

  await createEmail(jobUri, subject, content);
}

async function createEmail(jobUri, subject, content) {
  const id = uuid();
  const uri = EMAIL_URI_PREFIX + id;
  await update(`
    PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
    PREFIX nmo: <http://www.semanticdesktop.org/ontologies/2007/03/22/nmo#>
    PREFIX dct: <http://purl.org/dc/terms/>

    INSERT DATA {
      GRAPH ${sparqlEscapeUri(EMAIL_GRAPH)} {
        ${sparqlEscapeUri(uri)} a nmo:Email ;
          mu:uuid ${sparqlEscapeString(id)} ;
          nmo:messageSubject ${sparqlEscapeString(subject)} ;
          nmo:htmlMessageContent ${sparqlEscapeString(content)} ;
          nmo:isPartOf ${sparqlEscapeUri(EMAIL_FOLDER_URI)} ;
          dct:creator ${sparqlEscapeUri(JOB_CREATOR_URI)} ;
          dct:references ${sparqlEscapeUri(jobUri)} ;
          dct:created ${sparqlEscapeDateTime(new Date())} .
      }
    }
  `);
  console.info(`Alert email created: ${uri}`);
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

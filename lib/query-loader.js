import fs from 'fs-extra';
import path from 'path';
import pkg from 'sparqljs';
const { Parser: SparqlParser } = pkg;

import { MONITORING_QUERIES_FOLDER } from '../config.js';
import { MONITORING_QUERY_URI_PREFIX } from './constants.js';

async function getSparqlFiles(dir) {
  const files = await fs.readdir(dir);
  let sparqlFiles = [];

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stat = await fs.stat(filePath);

    if (stat.isDirectory()) {
      sparqlFiles = sparqlFiles.concat(await getSparqlFiles(filePath));
    } else if (file.endsWith('.rq') || file.endsWith('.sparql')) {
      sparqlFiles.push(filePath);
    }
  }
  return sparqlFiles;
}

function deriveQueryName(filePath) {
  return path.basename(filePath, path.extname(filePath));
}

function deriveQueryUri(name) {
  return MONITORING_QUERY_URI_PREFIX + encodeURIComponent(name);
}

async function loadSidecar(filePath) {
  const dir = path.dirname(filePath);
  const baseName = path.basename(filePath, path.extname(filePath));
  const sidecarPath = path.join(dir, `${baseName}.config.json`);

  if (await fs.pathExists(sidecarPath)) {
    return fs.readJson(sidecarPath);
  }
  return null;
}

export async function loadMonitoringQueries() {
  const parser = new SparqlParser();
  const queries = [];

  for (const filePath of await getSparqlFiles(MONITORING_QUERIES_FOLDER)) {
    const fileContent = await fs.readFile(filePath, 'utf8');

    try {
      const parsedQuery = parser.parse(fileContent);

      if (parsedQuery.type !== 'query' || parsedQuery.queryType !== 'SELECT') {
        console.warn(`Skipping ${filePath}: only SELECT queries are supported`);
        continue;
      }

      const sidecar = await loadSidecar(filePath);
      const name = sidecar?.name || deriveQueryName(filePath);

      if (sidecar?.enabled === false) {
        console.info(`Skipping disabled query: ${name}`);
        continue;
      }

      queries.push({
        name,
        uri: deriveQueryUri(name),
        filePath,
        parsedQuery,
        rawQuery: fileContent,
        thresholds: sidecar?.thresholds || {},
      });
    } catch (error) {
      console.error(`Error parsing file ${filePath}:`, error.message);
      throw error;
    }
  }

  console.info(`Loaded ${queries.length} monitoring queries`);
  return queries;
}

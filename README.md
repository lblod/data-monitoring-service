# data-monitoring-service

Proactive data quality monitoring for semantic.works stacks. Runs user-defined SPARQL SELECT queries on a schedule, auto-transforms them into count/completeness queries, compares results against historical baselines, and stores anomaly records in the triplestore.

The service only executes aggregate count queries - no personal or identifiable data is accessed or persisted.

## How it works

1. **Query loading**: Reads `.sparql`/`.rq` files from a config volume
2. **Transformation**: Parses each SELECT query with `sparqljs`, identifies variables that appear only in OPTIONAL blocks and are part of the original SELECT projection, then generates a count query: `COUNT(*)` for total rows + `COUNT(?var)` per optional variable for coverage.
3. **Execution**: Runs the count queries through mu-auth using a service scope (`DEFAULT_MU_AUTH_SCOPE`). Graph scoping is handled by the authorization config, so queries don't need explicit `GRAPH` clauses.
4. **Anomaly detection**: Compares current values to the median of the last N runs. Flags deviations exceeding a configurable threshold
5. **Storage**: Persists observations and anomalies as RDF in a monitoring graph

## Scheduling

Uses `scheduled-job-controller-service`. When the cron fires, the controller
instantiates a `cogs:Job` + `task:Task` from the `cogs:ScheduledJob` +
`task:ScheduledTask` template. This service listens on `/delta` for the new
task and executes the monitoring run against the existing task/job (no new
job is created by this service in the scheduled flow).

Seed the template via migration:

```sparql
PREFIX cogs: <http://vocab.deri.ie/cogs#>
PREFIX task: <http://redpencil.data.gift/vocabularies/tasks/>
PREFIX mu: <http://mu.semte.ch/vocabularies/core/>
PREFIX dct: <http://purl.org/dc/terms/>
PREFIX schema: <http://schema.org/>
PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>

INSERT DATA {
  GRAPH <http://mu.semte.ch/graphs/system/jobs> {
    <http://data.lblod.info/id/scheduled-job/data-monitoring>
      a cogs:ScheduledJob ;
      mu:uuid "data-monitoring-scheduled-job" ;
      task:operation <http://redpencil.data.gift/id/jobs/concept/JobOperation/dataMonitoring> ;
      task:schedule <http://data.lblod.info/id/schedule/data-monitoring> .

    <http://data.lblod.info/id/schedule/data-monitoring>
      a task:CronSchedule ;
      mu:uuid "data-monitoring-schedule" ;
      schema:repeatFrequency "0 2 * * *" .

    <http://data.lblod.info/id/scheduled-task/data-monitoring>
      a task:ScheduledTask ;
      mu:uuid "data-monitoring-scheduled-task" ;
      dct:isPartOf <http://data.lblod.info/id/scheduled-job/data-monitoring> ;
      dct:created "2026-04-13T00:00:00.000Z"^^xsd:dateTime ;
      dct:modified "2026-04-13T00:00:00.000Z"^^xsd:dateTime ;
      task:index "0" ;
      task:operation <http://redpencil.data.gift/id/jobs/concept/TaskOperation/dataMonitoring/runQueries> .
  }
}
```

The delta-notifier must route `adms:status` inserts to both this service and
`scheduled-job-controller`. This service additionally filters the changeset
for inserts of `task:operation = <…/TaskOperation/dataMonitoring/runQueries>`.

## Query configuration

Place SPARQL SELECT files in the queries volume. Optional `.config.json` sidecars (same basename) allow per-query settings:

```json
{
  "name": "Human readable name",
  "enabled": true,
  "thresholds": {
    "totalRows": { "dropPercent": 5, "spikePercent": 20 },
    "completeness_voornaam": { "dropPercent": 15 }
  }
}
```

## docker-compose snippet

```yaml
data-monitoring:
  image: lblod/data-monitoring-service:0.1.0
  environment:
    JOB_CREATOR_URI: "http://data.lblod.info/services/id/data-monitoring-service"
    DEFAULT_MU_AUTH_SCOPE: "http://services.semantic.works/data-monitoring"
    ANOMALY_THRESHOLD_PERCENT: "10"
    ANOMALY_COMPARISON_WINDOW: "5"
  volumes:
    - ./config/data-monitoring/queries:/config/queries
```

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MONITORING_QUERIES_FOLDER` | `/config/queries` | Path to SPARQL query files |
| `MONITORING_GRAPH` | `http://mu.semte.ch/graphs/system/monitoring` | Graph for observations and anomalies |
| `JOBS_GRAPH` | `http://mu.semte.ch/graphs/system/jobs` | Graph for job/task resources |
| `ANOMALY_THRESHOLD_PERCENT` | `10` | Default percentage deviation to trigger an anomaly |
| `ANOMALY_COMPARISON_WINDOW` | `5` | Number of previous runs to compute the baseline median |
| `JOB_CREATOR_URI` | `http://data.lblod.info/services/id/data-monitoring-service` | Creator URI for jobs |
| `JOB_OPERATION_URI` | `http://redpencil.data.gift/id/jobs/concept/JobOperation/dataMonitoring` | Job operation URI |
| `DEFAULT_MU_AUTH_SCOPE` | *(none)* | Service scope for mu-auth. Set in docker-compose to grant access to the relevant graphs |
| `EMAIL_FROM` | `noreply@lblod.info` | Sender address for alert emails |
| `EMAIL_TO` | `noreply@lblod.info` | Recipient address for alert emails |
| `EMAIL_GRAPH` | `http://mu.semte.ch/graphs/system/email` | Graph for email resources |
| `EMAIL_FOLDER_URI` | `http://data.lblod.info/id/mail-folders/2` | Outbox folder URI |

## Authorization (mu-auth scope)

The service uses a [mu-auth scope](https://github.com/mu-semtech/sparql-parser) to access the triplestore. The scope is set via `DEFAULT_MU_AUTH_SCOPE` in docker-compose, and must match a `with-scope` block in the authorization config.

The service needs:
- **read** access to the data graph (for running count queries)
- **read/write** access to the monitoring, jobs, and email graphs

Add the required prefixes and graph definitions to `config/authorization/config.lisp`:

```lisp
(define-prefixes
  ;; ... existing prefixes ...
  :mon "http://lblod.data.gift/vocabularies/monitoring/"
  :nmo "http://www.semanticdesktop.org/ontologies/2007/03/22/nmo#"
  :nfo "http://www.semanticdesktop.org/ontologies/2007/03/22/nfo#"
  :cogs "http://vocab.deri.ie/cogs#"
  :task "http://redpencil.data.gift/vocabularies/tasks/"
  :oslc "http://open-services.net/ns/core#")

(define-graph monitoring-graph ("http://mu.semte.ch/graphs/system/monitoring")
  ("mon:MonitoringRun" -> _)
  ("mon:Observation" -> _)
  ("mon:Anomaly" -> _))

(define-graph email-graph ("http://mu.semte.ch/graphs/system/email")
  ("nmo:Email" -> _)
  ("nmo:Mailbox" -> _)
  ("nfo:Folder" -> _))

(define-graph jobs-graph ("http://mu.semte.ch/graphs/system/jobs")
  ("cogs:Job" -> _)
  ("task:Task" -> _)
  ("cogs:ScheduledJob" -> _)
  ("task:CronSchedule" -> _)
  ("oslc:Error" -> _))
```

Grant access within the scope. The `with-scope` block ensures these grants only apply to requests carrying the matching `mu-auth-scope` header. Replace `dwh-reporting` with the graph that holds the data you want to monitor:

```lisp
(with-scope "service:data-monitoring"
  (grant (read)
         :to dwh-reporting
         :for "public")
  (grant (read write)
         :to monitoring-graph
         :for "public")
  (grant (read write)
         :to jobs-graph
         :for "public")
  (grant (read write)
         :to email-graph
         :for "public"))
```

## Email alerts

When anomalies are detected, the service creates an `nmo:Email` in the outbox folder. The `deliver-email-service` picks it up and sends it. Requires:
- `deliver-email-service` in the stack
- Mailbox and folder seed migration (see `config/migrations/`)

## REST API

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/delta` | Delta notification endpoint (used by delta-notifier) |
| `POST` | `/monitoring-runs` | Manually trigger a monitoring run |

## RDF model

All resources stored in the monitoring graph use prefix `mon: <http://lblod.data.gift/vocabularies/monitoring/>`.

- **`mon:MonitoringRun`** — one per execution per query, linked to `cogs:Job` via `dct:isPartOf`
- **`mon:Observation`** — metric value (`mon:metricName`, `mon:value`) linked to a run
- **`mon:Anomaly`** — detected deviation with `mon:previousValue`, `mon:currentValue`, `mon:changePercent`, `mon:severity`

### Query all metrics

The query below only returns aggregate counts — no personal or identifiable data — so the export can safely be analysed outside of the data warehouse server. See `analysis.ipynb` for a ready-to-use Jupyter notebook that visualizes coverage, trends, and change detection from a CSV export.

```sparql
PREFIX mon: <http://lblod.data.gift/vocabularies/monitoring/>
PREFIX dct: <http://purl.org/dc/terms/>

SELECT ?queryName ?metricName ?value ?created
WHERE {
  ?obs a mon:Observation ;
    mon:forQuery ?query ;
    mon:metricName ?metricName ;
    mon:value ?value ;
    mon:partOfRun ?run .
  ?run dct:created ?created .
  BIND(REPLACE(STR(?query), "^.*/", "") AS ?queryName)
}
ORDER BY ?queryName DESC(?created) ?metricName
```


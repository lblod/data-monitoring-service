import pkg from 'sparqljs';
const { Generator: SparqlGenerator } = pkg;

const sparqlGenerator = new SparqlGenerator();

/**
 * Recursively collect all variable names from a SPARQL AST pattern array.
 */
function collectVariables(patterns) {
  const vars = new Set();

  for (const pattern of patterns) {
    if (pattern.type === 'bgp') {
      for (const triple of pattern.triples) {
        for (const pos of ['subject', 'predicate', 'object']) {
          if (triple[pos].termType === 'Variable') {
            vars.add(triple[pos].value);
          }
        }
      }
    } else if (pattern.type === 'optional' || pattern.type === 'group') {
      for (const v of collectVariables(pattern.patterns)) {
        vars.add(v);
      }
    } else if (pattern.type === 'union') {
      for (const alternative of pattern.patterns) {
        for (const v of collectVariables(alternative.patterns || [alternative])) {
          vars.add(v);
        }
      }
    } else if (pattern.type === 'graph') {
      for (const v of collectVariables(pattern.patterns)) {
        vars.add(v);
      }
    } else if (pattern.type === 'bind') {
      if (pattern.variable?.termType === 'Variable') {
        vars.add(pattern.variable.value);
      }
    } else if (pattern.type === 'values') {
      for (const v of pattern.values || []) {
        for (const key of Object.keys(v)) {
          if (key.startsWith('?')) {
            vars.add(key.slice(1));
          }
        }
      }
    } else if (pattern.type === 'filter') {
      // filters don't introduce new variables
    }
  }
  return vars;
}

/**
 * Collect variables that appear only inside OPTIONAL blocks.
 * A variable that also appears in a mandatory pattern is not considered optional.
 */
function findOptionalVariables(whereClause) {
  const mandatoryVars = new Set();
  const optionalVars = new Set();

  for (const pattern of whereClause) {
    if (pattern.type === 'optional') {
      for (const v of collectVariables(pattern.patterns)) {
        optionalVars.add(v);
      }
    } else if (pattern.type === 'graph') {
      // Within a GRAPH block, separate mandatory from optional patterns
      for (const subPattern of pattern.patterns) {
        if (subPattern.type === 'optional') {
          for (const v of collectVariables(subPattern.patterns)) {
            optionalVars.add(v);
          }
        } else {
          for (const v of collectVariables([subPattern])) {
            mandatoryVars.add(v);
          }
        }
      }
    } else {
      for (const v of collectVariables([pattern])) {
        mandatoryVars.add(v);
      }
    }
  }

  // Only keep variables that are exclusively optional
  const exclusivelyOptional = new Set();
  for (const v of optionalVars) {
    if (!mandatoryVars.has(v)) {
      exclusivelyOptional.add(v);
    }
  }
  return exclusivelyOptional;
}

/**
 * Extract projected variable names from the original SELECT clause.
 * Handles both explicit variable lists and SELECT *.
 */
function getSelectedVariableNames(parsedQuery) {
  const vars = parsedQuery.variables;
  if (!vars || vars.length === 0) return new Set();

  // SELECT *
  if (vars.length === 1 && vars[0].termType === 'Wildcard') {
    return collectVariables(parsedQuery.where);
  }

  const names = new Set();
  for (const v of vars) {
    if (v.termType === 'Variable') {
      names.add(v.value);
    } else if (v.variable?.termType === 'Variable') {
      // expression AS ?alias
      names.add(v.variable.value);
    }
  }
  return names;
}

const RDF_TYPE_FULL = '<http://www.w3.org/1999/02/22-rdf-syntax-ns#type>';
const RDF_TYPE_SHORT = 'a';

/**
 * Transform a parsed SELECT query into a COUNT query.
 *
 * Only counts optional variables that appear in the original SELECT clause.
 * Uses COUNT(?var) (non-null count) for coverage metrics.
 * Graph scoping is handled by mu-auth via scopes, not by the query itself.
 *
 * Returns an object with:
 * - countQuery: the SPARQL string for the count query
 * - optionalVariables: array of variable names that are counted
 */
export function transformToCountQuery(parsedQuery) {
  const optionalVars = findOptionalVariables(parsedQuery.where);
  const selectedVars = getSelectedVariableNames(parsedQuery);

  // Only count optional variables that are in the original SELECT
  const countableVars = Array.from(optionalVars)
    .filter(v => selectedVars.has(v))
    .sort();

  // Build aggregation variables
  const variables = [
    {
      expression: {
        type: 'aggregate',
        aggregation: 'count',
        expression: { termType: 'Wildcard', value: '*' },
        distinct: false,
      },
      variable: { termType: 'Variable', value: 'totalRows' },
    },
  ];

  for (const varName of countableVars) {
    variables.push({
      expression: {
        type: 'aggregate',
        aggregation: 'count',
        expression: { termType: 'Variable', value: varName },
        distinct: false,
      },
      variable: { termType: 'Variable', value: `completeness_${varName}` },
    });
  }

  const countAst = {
    ...parsedQuery,
    variables,
    where: parsedQuery.where,
    distinct: false,
    limit: undefined,
    offset: undefined,
    order: undefined,
    group: undefined,
    having: undefined,
  };

  let countQuery = sparqlGenerator.stringify(countAst);

  // Restore `a` shorthand where sparqljs expanded rdf:type
  countQuery = countQuery.replaceAll(RDF_TYPE_FULL, RDF_TYPE_SHORT);

  return {
    countQuery,
    optionalVariables: countableVars,
  };
}

/**
 * Wraps a delta-notifier payload (array of change sets, each with `inserts`
 * and `deletes` of `{subject, predicate, object}` triples) and exposes
 * convenience filters. Mirrors the canonical pattern used in
 * job-controller-service / scheduled-job-controller-service.
 */
export class Delta {
  constructor(delta) {
    this.delta = Array.isArray(delta) ? delta : [];
  }

  get inserts() {
    return this.delta.flatMap(changeSet => changeSet.inserts || []);
  }

  get deletes() {
    return this.delta.flatMap(changeSet => changeSet.deletes || []);
  }

  /**
   * Subjects of inserted triples matching the given predicate (and optionally object).
   * @returns {string[]} subject URIs
   */
  getInsertsFor(predicate, object) {
    return this.inserts
      .filter(t =>
        t.predicate?.value === predicate &&
        (object === undefined || t.object?.value === object)
      )
      .map(t => t.subject.value);
  }

  /**
   * Object value for a given (subject, predicate) within the insert set.
   * @returns {string|undefined}
   */
  getInsertObject(subject, predicate) {
    const triple = this.inserts.find(t =>
      t.subject?.value === subject &&
      t.predicate?.value === predicate
    );
    return triple?.object?.value;
  }
}

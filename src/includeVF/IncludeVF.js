import { CLASS_PROP, INCLUDE_VF } from "../constants/objectTypes";
import { isIncludeVFArg } from "../utils/objectTypes";

/**
 * Handles a single includeVF for a Query instance
 * @class IncludeVF
 */
export default class IncludeVF {

  constructor(ownQuery, VFName) {
    this.ownQuery = ownQuery;
    this.VFName = VFName;
  }

  static init(ownQuery, VFName) {
    return new this(ownQuery, VFName);
  }

  isDifferentThan(otherIncludeVF) {
    if (
      !isIncludeVFArg(otherIncludeVF)
      || this.VFName !== otherIncludeVF.VFName
    ) {
      return true;
    }
    const { query } = this,
      { query: otherQuery } = otherIncludeVF;
    if (query && otherQuery) {
      return query.isDifferentThan(otherQuery);
    } else {
      return !!(query || otherQuery);
    }
  }

  remove() {
    this.ownQuery.removeInclude(this);
    this.ownQuery = undefined;
    this.query = undefined;
  }

  clone() {
    throw new Error('Not setup...');
  }

  addFromQuery(query) {
    throw new Error('addFromQuery() not setup in default Query IncludeVF');
  }

  addFromFn(fn) {
    throw new Error('addFromFn() not setup in default Query IncludeVF');
  }

  addSelect(fields) {
    throw new Error('addSelect() not setup in default Query IncludeVF');
  }

  merge(includeVF, payload) {
    throw new Error('includeVF merge() is not setup in default Query.');
  }

  includeAll(fields, payload) {
    let { query } = this;
    if (query) {
      const { queryArgs } = query;
      if (queryArgs) {
        query.queryArgs = undefined;
      }
    } else {
      this.query = query = this.createQueryInstance(payload);
    }
    if (fields) {
      if (fields !== true) {
        query.deSelectAll();
        query.select(fields);
      }
    } else {
      query.selectAll();
    }
  }

  selectAllQueryArgs(targetQuery, payload) {
    const { query } = this;
    if (query) {
      let includeVF, includeVFQuery;
      if (targetQuery === this.ownQuery) {
        query.selectAllQueryArgs(query, query, payload);
        /**
         * We don't need to call includeAll() to wipe out
         * our arguments because the only time that would be
         * necessary is if this is because of a VFQueryArg
         * that had selectAllQueryArgs() called. But if that
         * is the case, it will call our includeAll(). Otherwise
         * we assume this request is meant to only affect
         * our current arguments.
         */
      } else {
        includeVF = targetQuery._getOrInitIncludeVF(this.VFName, payload);
        ({ query: includeVFQuery } = includeVF);
        if (!includeVFQuery) {
          includeVFQuery = includeVF.createQueryInstance(payload);
          if (payload && payload.children) {
            query.selectAllQueryArgs(
              includeVFQuery, query, payload.children[this.VFName]
            );
          } else {
            query.selectAllQueryArgs(includeVFQuery, query);
          }
        } else {
          /**
           * We need to select what is needed for the query before
           * overwriting the args that may already exist for the includeVF
           * query (since those are the args we want selected). This won't
           * happen if the targetQuery is different than our query.
           */
          if (payload && payload.children) {
            query.selectAllQueryArgs(
              includeVFQuery, query, payload.children[this.VFName]
            );
          } else {
            query.selectAllQueryArgs(includeVFQuery, query);
          }
          // now it is safe to remove the args that were being analyzed.
          targetQuery.includeAll(this.VFName, true, payload);
        }
      }
    }
  }

  /**
   * Looks at the provided data object, and if
   * the data object has data under our VFName,
   * we pass the VFData on to our query so it
   * can update its queryArgs/includeVFs.
   * @param data
   * @param variables
   * @returns {IncludeVF}
   */
  updateQueryArgs(data, variables) {
    const { [this.VFName]: VFData } = data;
    if (VFData) {
      const { query } = this;
      if (query) {
        query.updateQueryArgs(VFData, variables);
      }
    }
    return this;
  }
}

Object.defineProperty(
  IncludeVF,
  CLASS_PROP,
  {
    value: INCLUDE_VF,
    enumerable: false,
    writable: false
  }
);

Object.defineProperty(
  IncludeVF.prototype,
  CLASS_PROP,
  {
    value: INCLUDE_VF,
    enumerable: false,
    writable: false
  }
);
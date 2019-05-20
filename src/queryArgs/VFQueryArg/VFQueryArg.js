import { isValidOperator } from "@bit/appify.core.utils.matching";
import { CLASS_PROP, ARG_VF_QUERY } from "../../constants/objectTypes";
import { isQuery, isVFQueryArg } from "../../utils/objectTypes";

/**
 * Used during checkRecord if there are no queryArgs to
 * avoid calling query.checkRecord() since that would
 * manually check for queryArgs every single time.
 * @constant defaultQueryArgs
 * @returns {boolean}
 */
const defaultQueryArgs = {
  checkRecord: () => true
};

/**
 * @class VFQueryArg
 */
export default class VFQueryArg {

  constructor(queryArgs, not, join, originalArg) {
    this.isMany = true; // we always assume we are isMany, this only matters for ModelQuery.
    this.not = not || false;
    this.join = join || false;
    this.queryArgs = queryArgs;
    queryArgs.query.queryHasVF = true;
    /**
     * originalArg is provided when we are
     * converting m2m VFQueries into
     * through queries (only applies to
     * ModelQuery). In that case, we don't
     * want to add to the queryArgs, but
     * just replace what already exists.
     */
    if (originalArg) {
      this.argIdx = originalArg.argIdx;
      this.argsGroupIdx = originalArg.argsGroupIdx;
      /**
       * Call on the query, since queryHierarchy mixin hooks
       * into the call to make sure siblings are correct.
       */
      queryArgs.query.replaceQueryArg(originalArg, this);
    } else {
      this.argIdx = queryArgs.push(this) - 1;
      if (join === 'or') {
        queryArgs.argsGroupIdx++;
      }
      this.argsGroupIdx = queryArgs.argsGroupIdx;
    }
    this._init();
  }

  _init() {}

  get ownQuery() {
    return this.queryArgs.query;
  }

  /**
   * Alias groupedQuery so VFQueryArgs and GroupedQueryArgs
   * can be handled the same without having to access each
   * query by a different name (groupedQuery vs VFQuery)
   */
  get query() {
    return this.VFQuery;
  }

  set query(query) {
    this.VFQuery = query;
  }

  /**
   * @deprecated
   * @returns {*}
   */
  get fn() {
    return this.VFQuery.getFilterFn();
  }

  /**
   * Initializes a new VFQueryArg arg.
   * @param {QueryArgs} queryArgs The queryArgs for the
   * query
   * @param {boolean} not - if true, the VFQueryArg was added by a whereXXNot() method
   * @param {?string=} [join]  If this is the first
   * whereXXX(), it will be undefined. Otherwise 'and' || 'or'
   * @param {string} VFName - The name of the virtual field
   * @param {(function(Query): Query|Object)} value
   * @param {string|Object} [extraParam] -
   * If value is a function, extraParam can be an object
   * as it will become the thisArg. If value is an object, extraParam
   * can be a string to declare the operator for the key->value
   * where clauses.
   * @param {?VFQueryArg=} [instance] - If provided, a
   * method before us already created the VFQueryArg instance
   * @returns {*}
   */
  static create(
    queryArgs, not, join, VFName, value, extraParam, instance
  ) {
    let VFQuery;
    if (!instance) {
      instance = new this(queryArgs, not, join);
      VFQuery = instance.createQueryInstance();
    } else if (!instance.VFQuery) {
      VFQuery = instance.createQueryInstance();
    }
    instance.VFName = VFName;
    if (isQuery(value)) {
      VFQuery.buildFromQuery(value);
    } else {
      const typeofValue = typeof value;
      if (typeofValue === 'object') {
        /**
         * You could avoid grouping the VF if it isn't an "isMany" relationship,
         * since you would be looking at the same record each time. But when it
         * is an "isMany" relationship, the filterFn runs each "and" against
         * ALL refs and if 1 hits, it says "true' for that "and", then continues.
         * But by grouping in this way you can ensure all "where" clauses are
         * run against each ref
         *
         * The extraParam could be an operator. So check if it is of
         * type STRING, if not make it '='
         */
        const operator = isValidOperator(extraParam) ? extraParam : '=';
        let i = 0;
        for(let key in value) {
          if (i === 0) {
            VFQuery = VFQuery.where(key, operator, value[key]);
          } else {
            VFQuery = VFQuery.andWhere(key, operator, value[key]);
          }
          i++;
        }
      } else if (typeofValue === 'function') {
        if (extraParam) {
          const type = typeof extraParam;
          /**
           * It could be 'function' if the request is
           * coming from a static class method
           */
          if (type === 'object' || type === 'function') {
            value.call(extraParam, VFQuery);
          } else {
            value(VFQuery);
          }
        } else {
          value(VFQuery);
        }
      } else {
        throw new Error('Querying a Virtual Field requires either an object ' +
          'of key:value pairs, or a function. Got: ' + typeofValue);
      }
    }

    instance.VFQuery = VFQuery;
    if (queryArgs.allArgsSelected) {
      instance.selectAllQueryArgs(queryArgs.query);
    }
    return instance;
  }

  clone(newArgs, newJoin) {
    if (typeof newJoin === 'undefined') {
      newJoin = this.join;
    }
    const instance = new this.constructor(newArgs, this.not, newJoin);
    instance.VFName = this.VFName;
    instance.VFQueryArg = this.VFQuery.clone(instance.ownQuery);
    return instance;
  }

  createQueryInstance() {
    const { ownQuery } = this;
    const instance = ownQuery.constructor.init(ownQuery.model[this.VFName]);
    this.VFQuery = instance;
    instance.setAsVFQuery(this);
    return instance;
  }

  getRefs(record) {
    return record[this.VFName];
  }

  checkRecord(record, variables) {
    const refs = this.getRefs(record);
    if (!refs) {
      return false;
    }
    if (this.isMany) {
      let isOk = false, { query: { queryArgs } } = this;
      if (!queryArgs) {
        queryArgs = defaultQueryArgs;
      }
      if (this.not) {
        for(let k in refs) {
          if (!queryArgs.checkRecord(refs[k], variables)) {
            isOk = true;
            break;
          }
        }
      } else {
        for(let k in refs) {
          if (queryArgs.checkRecord(refs[k], variables)) {
            isOk = true;
            break;
          }
        }
      }
      return isOk;
    } else {
      return this.not ? !this.query.checkRecord(refs, variables)
        : this.query.checkRecord(refs, variables);
    }
  }

  selectAllQueryArgs(targetQuery, payload) {
    const { query } = this;
    if (query) {
      const includeVF = targetQuery._getOrInitIncludeVF(this.VFName, payload);
      let { query: includeVFQuery } = includeVF, childPayload;
      if (!includeVFQuery) {
        includeVFQuery = includeVF.createQueryInstance(payload);
        if (payload) {
          // if payload existed, createQueryInstance() would ensure
          // there is a payload for the created query
          childPayload = payload.children[this.VFName];
        }
        query.selectAllQueryArgs(includeVFQuery, query, childPayload);
      } else {
        /**
         * We need to select what is needed for the query before
         * overwriting the args that may already exist for the includeVF
         * query (since those are the args we want selected). This won't
         * happen if the targetQuery is different than our query.
         */
        if (payload && payload.children) {
          childPayload = payload.children[this.VFName];
        }
        query.selectAllQueryArgs(includeVFQuery, query, childPayload);
        // now it is safe to remove the args that were being analyzed.
        targetQuery.includeAll(this.VFName, true, payload);
      }
    }
  }


  /**
   * Updates the VFQuery if there is VFData on
   * the provided data object (keyed by the VFName)
   * @param data
   * @param variables
   * @returns {VFQueryArg}
   */
  updateArg(data, variables) {
    const { [this.VFName]: VFData } = data;
    if (VFData) {
      this.query.updateQueryArgs(VFData, variables);
    }
    return this;
  }

  isDifferentThan(otherArg) {
    if (
      !isVFQueryArg(otherArg)
      || this.not !== otherArg.not
      || this.join !== otherArg.join
      || this.VFName !== otherArg.VFName
    ) {
      return true;
    }
    const { query } = this,
      { query: otherQuery } = otherArg;
    if (query && otherQuery) {
      return query.isDifferentThan(otherQuery);
    } else {
      return !!(query || otherQuery);
    }
  }
}

Object.defineProperty(
  VFQueryArg,
  CLASS_PROP,
  {
    value: ARG_VF_QUERY,
    enumerable: false,
    writable: false
  }
);

Object.defineProperty(
  VFQueryArg.prototype,
  CLASS_PROP,
  {
    value: ARG_VF_QUERY,
    enumerable: false,
    writable: false
  }
);
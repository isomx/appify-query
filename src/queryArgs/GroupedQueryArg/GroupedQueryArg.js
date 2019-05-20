import { GROUPED_QUERY } from "../../constants/instanceTypes";
import { ARG_GROUPED_QUERY, CLASS_PROP } from "../../constants/objectTypes";
import mergeDirectives from '../../directives/mergeDirectives';
import { isGroupedQueryArg } from "../../utils/objectTypes";

/**
 * @class GroupedQueryArg
 */
export default class GroupedQueryArg {

  constructor(queryArgs, not, join) {
    this.groupedQuery = undefined;
    this.not = not || false;
    this.join = join || false;
    this.argIdx = queryArgs.push(this) - 1;
    this.queryArgs = queryArgs;
    if (join === 'or') {
      queryArgs.argsGroupIdx++;
    }
    this.argsGroupIdx = queryArgs.argsGroupIdx;
  }

  get ownQuery() {
    return this.queryArgs.query;
  }

  /**
   * Alias groupedQuery so VFQueryArgs and GroupedQueryArgs
   * can be handled the same without having to access each
   * query by a different name (groupedQuery vs VFQuery)
   */
  get query() {
    return this.groupedQuery;
  }

  static createFromExistingQuery(queryArgs, not, join, existingQuery) {
    /**
     * If there aren't any queryArgs, just merge any Select fields, includeVFs, and directives.
     */
    if (existingQuery.queryArgs) {
      const instance = new this(queryArgs, not, join);
      instance.groupedQuery = existingQuery.clone(instance.ownQuery, instance.argIdx, GROUPED_QUERY);
      if (queryArgs.allArgsSelected) {
        instance.selectAllQueryArgs(queryArgs.query);
      }
      return instance;
    } else {
      const { querySelect, includeVFs } = existingQuery;
      const { query } = queryArgs;
      if (querySelect) {
        query.mergeSelect(querySelect);
      }
      if (includeVFs) {
        query.mergeIncludeVFs(includeVFs);
      }
      mergeDirectives(query, existingQuery);
    }
  }

  /**
   * Clones the GroupedQueryArg and returns a new instance
   * @param {QueryArgs} newArgs
   * @param {?string=} newJoin
   * @returns {GroupedQueryArg}
   */
  clone(newArgs, newJoin) {
    if (typeof newJoin === 'undefined') {
      newJoin = this.join;
    }
    const instance = new this.constructor(newArgs, this.not, newJoin);
    instance.groupedQuery = this.groupedQuery.clone(instance.ownQuery);
    return instance;
  }

  /**
   * This is only called if the obj has more than 1 key,
   * since it must be grouped as or(and-and-and-...),
   * so a groupedQuery instance must be created.
   * @param {QueryArgs} queryArgs
   * @param not
   * @param join
   * @param keys
   * @param keysLength
   * @param obj
   * @param op
   */
  static createFromOrObject(queryArgs, not, join, keys, keysLength, obj, op) {
    /**
     * The typeof of each value in the key:value obj
     * must be checked because it could be a VF
     * (represented by being a function).
     * If it is a function, call the appropriate
     * method with the function but exclude the op
     * since it won't matter because the function will
     * be called with a query instance.
     * Also if op === 'in' do not use whereIn if the
     * value is a function since that is also
     * irrelevant because the provided function will
     * return the appropriately built query.
     * This happens when providing an object with
     * regular keys and VFs.
     */
    const instance = new this(queryArgs, not, join);
    // start i = 1 because the first arg is where/whereIn, not andWhere/andWhereIn
    // so it needs to be handled before the loop.
    let key = keys[0], i = 1, groupedQuery = instance.createQueryInstance();
    let value = obj[key];
    if (op === 'in') {
      groupedQuery = typeof value === 'function' ? groupedQuery.where(key, value)
        : groupedQuery.whereIn(key, value);
      while(i < keysLength) {
        key = keys[i];
        value = obj[key];
        groupedQuery = typeof value === 'function' ?
          groupedQuery.andWhere(key, value) : groupedQuery.andWhereIn(key, value);
        i++;
      }
    } else {
      groupedQuery = typeof value === 'function' ?
        groupedQuery.where(key, value) : groupedQuery.where(key, op, value);
      while(i < keysLength) {
        key = keys[i];
        value = obj[key];
        groupedQuery = typeof value === 'function' ?
          groupedQuery.andWhere(key, value) : groupedQuery.andWhere(key, op, value);
        i++;
      }
    }
    instance.groupedQuery = groupedQuery;
    if (queryArgs.allArgsSelected) {
      instance.selectAllQueryArgs(queryArgs.query);
    }
    return instance;
  }

  /**
   *
   * @param {QueryArgs} queryArgs
   * @param not
   * @param join
   * @param fn
   * @param thisArg
   * @param groupedQuery
   * @returns {GroupedQueryArg|boolean}
   */
  static createFromFn(queryArgs, not, join, fn, thisArg, groupedQuery) {
    const instance = new this(queryArgs, not, join);
    if (!groupedQuery) {
      // if groupedQuery exists, it was handled by a parent
      // class, so all we have to do is the bookkeeping
      // and save the queryArg.
      groupedQuery = instance.createQueryInstance();
      if (thisArg) {
        fn.call(thisArg, groupedQuery);
      } else {
        fn(groupedQuery);
      }
    }
    /**
     * Make sure the groupedQuery is available on this instance
     * before calling the provided function in case the provided
     * function cares who its parent is, or wants to climb
     * farther up the chain of the query.
     */
    instance.groupedQuery = groupedQuery;
    /**
     * Ensure there are actually queryArgs for the groupedQuery. If
     * it was just used to create Select, includeVFs, or directives get
     * rid of the queryArg.
     */
    if (!groupedQuery.queryArgs) {
      queryArgs.splice(instance.argIdx, 1);
      // remove the groupedQuery, it was set when createQueryInstance()
      // was called.
      instance.groupedQuery = undefined;
      return false;
    } else {
      if (queryArgs.allArgsSelected) {
        instance.selectAllQueryArgs(queryArgs.query);
      }
      return instance;
    }
  }

  /**
   * @deprecated
   * @returns {*}
   */
  get fn() {
    return this.groupedQuery.getFilterFn();
  }

  createQueryInstance() {
    return this.ownQuery.createGroupedInstance(this);
  }

  checkRecord(record, variables) {
    return this.not ? !this.query.checkRecord(record, variables)
      : this.query.checkRecord(record, variables);
  }

  checkRecordForMutation(record, variables) {
    if (this.query.queryHasVF) {

    } else {
      return true;
    }
  }

  selectAllQueryArgs(targetQuery, payload) {
    const { query } = this;
    if (query) {
      query.selectAllQueryArgs(targetQuery, query, payload);
    }
  }

  /**
   * Updates the groupedQuery's queryArgs with the provided
   * data (if the query has any key that is in the data object).
   * @param data
   * @param variables
   * @returns {GroupedQueryArg}
   */
  updateArg(data, variables) {
    const { query } = this;
    if (query) {
      query.updateQueryArgs(data, variables);
    }
    return this;
  }

  isDifferentThan(otherArg) {
    if (
      !isGroupedQueryArg(otherArg)
      || this.not !== otherArg.not
      || this.join !== otherArg.join
    ) {
      return true;
    }
    const { query } = this,
      { query: otherQuery } = otherArg;
    if (query && otherQuery) {
      return query.isDifferentThan(otherQuery);
    }
    return !!(query || otherQuery);
  }

}

Object.defineProperty(
  GroupedQueryArg,
  CLASS_PROP,
  {
    value: ARG_GROUPED_QUERY,
    enumerable: false,
    writable: false
  }
);

Object.defineProperty(
  GroupedQueryArg.prototype,
  CLASS_PROP,
  {
    value: ARG_GROUPED_QUERY,
    enumerable: false,
    writable: false
  }
);
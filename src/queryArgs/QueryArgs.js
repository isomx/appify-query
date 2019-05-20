import GroupedQueryArg from './GroupedQueryArg';
import KeyValueArg from './KeyValueArg';
import VFQueryArg from './VFQueryArg';
import { isQuery } from "../utils/objectTypes";
import {
  CLASS_PROP,
  QUERY_ARGS,
  ARG_VF_QUERY,
  ARG_GROUPED_QUERY
} from "../constants/objectTypes";


/**
 * Manages the queryArgs for the Query
 * @class QueryArgs
 * @extends Array
 */
export default class QueryArgs extends Array {
  static GroupedQueryArg = GroupedQueryArg;
  static KeyValueArg = KeyValueArg;
  static VFQueryArg = VFQueryArg;

  constructor(query) {
    super();
    this.query = query;
    this.argsGroupIdx = 0;
    this.allArgsSelected = false;
  }

  static init(query) {
    return new this(query);
  }

  /**
   * Cloning queryArgs behaves a little differently because
   * a lot of things rely on queryArgs. For example, if we are
   * doing a full clone, but we wait on this method to return
   * the new queryArgs instance, we won't be able to handle
   * registering siblings and all of the other necessary
   * processing that may occur as queryArgs performs its clone.
   *
   * So queryArgs doesn't create its own instance, it uses the
   * instance created by the newQuery.
   * @param newQuery
   * @param isFullClone
   * @returns {QueryArgs}
   */
  clone(newQuery) {
    const { queryArgs } = newQuery;
    for(let arg of this) {
      arg.clone(queryArgs);
    }
    return queryArgs;
  }

  compileSiblings() {
    const { query: ownQuery } = this;
    let query, argType;
    for(let arg of this) {
      ({ [CLASS_PROP]: argType } = arg);
      if (argType === ARG_GROUPED_QUERY || argType === ARG_VF_QUERY) {
        ({ query } = arg);
        ownQuery.registerSibling(query);
        if (query.queryArgs) {
          query.queryArgs.compileSiblings();
        }
      }
    }
  }

  get RecordResult() {
    return this.query.RecordResult;
  }

  checkRecord(record, variables) {
    if (!record) return false;
    let i = 0, arg = this[0], isOk = true, argsGroupIdx = 0;
    while(arg) {
      if (isOk && !arg.checkRecord(record, variables)) {
        isOk = false;
      }
      i++;
      arg = this[i];
      if (arg && arg.argsGroupIdx !== argsGroupIdx) {
        if (isOk) {
          return isOk;
        } else {
          argsGroupIdx++;
          isOk = true;
        }
      }
    }
    return isOk;
  }

  createFilterFn(RecordResult) {
    if (!RecordResult) {
      ({ RecordResult } = this);
    }
    return (record, variables, includeSelect, keyBy, resp, forMutation) => {
      return this.checkRecord(record, variables, includeSelect, keyBy, resp, forMutation, RecordResult);
    }
  }

  removeArg(argOrIdx) {
    let idx, removedArg;
    if (typeof argOrIdx === 'number') {
      idx = argOrIdx;
      removedArg = this[idx];
      if (!removedArg) {
        return false;
      }
    } else {
      idx = this.indexOf(argOrIdx);
      if (idx < 0) {
        return false;
      }
      removedArg = argOrIdx;
    }
    let i = idx + 1, length = this.length, arg, decreaseArgsGroupIdx = false;
    const prevArg = this[idx - 1], nextArg = this[i],
      { argsGroupIdx, join } = removedArg;
    if (join === 'and') {
      // we know that there has to be a previous argument
      if (prevArg.join !== 'and' && (!nextArg || nextArg.join !== 'and')) {
        decreaseArgsGroupIdx = true;
      }
    } else if (!nextArg || nextArg.argsGroupIdx !== argsGroupIdx) {
      // we don't care about a previous argument if there is no join
      // or the join === 'or' since the argument we are about to remove
      // was the beginning of a new argsGroup.
      decreaseArgsGroupIdx = true;
    }
    if (idx === 0 && nextArg) {
      nextArg.join = undefined;
    }
    if (decreaseArgsGroupIdx) {
      // must also decrease the overall argsGroupIdx on queryArgs since
      // we have completely removed a group
      this.argsGroupIdx--;
      while(i < length) {
        arg = this[i];
        arg.argIdx--;
        arg.argsGroupIdx--;
        i++;
      }
    } else {
      while(i < length) {
        arg = this[i];
        arg.argIdx--;
        i++;
      }
    }
    this.splice(idx, 1);
    return removedArg;
  }

  mergeArgs(sourceArgs) {
    let i = 0, length = sourceArgs.length;
    sourceArgs[i].clone(this, 'or');
    i++;
    while(i < length) {
      sourceArgs[i].clone(this);
      i++;
    }
    return this;
  }

  /**
   * This determines what type of queryArgument needs to be
   * added & how. So this means that this method's parameters
   * will mean different things based on what the previous
   * parameter is. So we start by determining what type the
   * key argument is, then work from there.
   * @param key
   * @param op
   * @param value
   * @param not
   * @param join
   * @returns {QueryArgs}
   */
  addArg(key, op, value, not, join) {
    const typeofKey = isQuery(key) ? 'query' : typeof key;
    switch(typeofKey) {
      case 'function':
        /**
         * Format:
         * key = builderFn
         * op = thisArg
         */
        this.constructor.GroupedQueryArg.createFromFn(this, not, join, key, op);
        break;
      case 'query':
        /**
         * Passing op allows for an additional parameter. This
         * is used to control cloning or, in the case of ModelQuery,
         * whether constraints should be rebuilt. This is useful
         * to avoid having to duplicate the logic when
         * convertToGroupedQuery() method is called. Also,
         * if it wasn't done this way then you would just be adding
         * a queryArg to queryArgs without going through this method,
         * which could potentially throw things off (constraints...)
         * that rely on this method being called whenever an argument
         * is added.
         */
        this.constructor.GroupedQueryArg.createFromExistingQuery(
          this, not, join, key, op
        );
        break;
      case 'object':
        if (!op) {
          op = '=';
        }
        const keys = Object.keys(key);
        const keysLength = keys.length;
        if (join === 'or' && keysLength > 1) {
          /**
           * We need to group the args together so it will be
           * or(and-and-and) so it maintains consistency with how
           * mySQL parses it. But pass the op parameter since
           * the groupedQuery will be adding individual args to its
           * groupedQuery using the op that can be optionally provided
           * as the 2nd parameter to an object.
           */
          this.constructor.GroupedQueryArg.createFromOrObject(
            this, not, join, keys, keysLength, key, op
          );
        } else {
          /**
           * Note that we could still be an "or" with only 1 arg so
           * we don't have to group things together. This is why
           * we wait to mess with the "join" argument until after
           * i > 0.
           */
          const { KeyValue, VFQuery } = this.constructor;
          const obj = key;
          key = keys[0];
          value = obj[key];
          let i = 0;
          while(i < keysLength) {
            if (i > 0 && !join) {
              /**
               * This means the object was passed on a "where" clause,
               * not orWhere/andWhere/etc. But if there is only 1
               * key/value pair you do not want to proactively set
               * join === 'and', as this would completely throw off
               * analyzing the query (ands && ors are grouped, with
               * the first or/and giving the initial where() its context).
               */
              join = 'and';
            }
            key = keys[i];
            value = obj[key];
            if (typeof value === 'function') {
              /**
               * The key must be a VF, because creating a groupedQuery
               * within an object for standard keys is not supported.
               * This shouldn't come up in standard use, the main reason
               * for checking for a FN is when converting a graphQL
               * query to an internal query. So just avoids having
               * to override this entire method just to check if the
               * key is a VF.
               *
               * Note we don't pass the op as it won't matter.
               */
              VFQuery.create(this, not, join, key, value);
            } else {
              KeyValue.create(this, not, join, key, op, value);
            }
            i++;
          }
        }
        break;
      default:
        const typeofOp = typeof op;
        /**
         * Note that the op could actually be the value, and the
         * value could be null. Which would be saying
         * key === null, with the implied operator of '='. So
         * we have to guard against that by checking that op
         * is a truth-y value before seeing if it is an object
         * since typeof null === 'object'.
         */
        if (typeofOp === 'function' || (op && typeofOp === 'object')) {
          /**
           * If the op is an array throw error. It is an invalid
           * combination because if they had called whereIn() op
           * would be 'in', not an object. But if they forgot
           * to add xxxIN, that could happen.
           */
          if (Array.isArray(op)) {
            throw new Error('An array is not a valid argument to query ' +
              'a virtual field. A function or an object must be provided. ' +
              'Did you forget to add "in" to your where clause?');
          }
          /**
           * value could be an additional param as follows:
           * A) If op === function, value could be a thisArg
           * B) If op === object, value could be an operator
           * (used by graphql conversions)
           *
           * But key === VFName, op === builderFn || object.
           * Point is, you cannot call a regular key with a
           * 2nd argument of an object or fn unless the key is
           * a VF
           */
          this.constructor.VFQueryArg.create(this, not, join, key, op, value);
        } else {
          if (typeofOp !== 'undefined' && typeof value === 'undefined') {
            value = op;
            op = '=';
          }
          this.constructor.KeyValueArg.create(this, not, join, key, op, value);
        }
    }
    return this;
  }

  /**
   * Replaces a query argument. DO NOT call directly, always
   * run through the query instance method (replaceQueryArg())
   * since that is what queryHierarchyMixin hooks into should it
   * be part of the Query class.
   * @param argOrIdx
   * @param newArg
   * @returns returns the replaced arg so things like
   * queryHierarchyMixin that hooks into this method on the
   * query (well, replaceQueryArg()) can know how to properly
   * update the hierarchy.
   */
  replaceArg(argOrIdx, newArg) {
    let replacedArg;
    if (typeof argOrIdx === 'number') {
      replacedArg = this[argOrIdx];
      this[argOrIdx] = newArg;
    } else {
      replacedArg = this[argOrIdx.argIdx];
      this[argOrIdx.argIdx] = newArg;
    }
    return replacedArg;
  }

  updateArgs(data, variables) {
    for(let arg of this) {
      arg.updateArg(data, variables);
    }
  }

  selectAllQueryArgs(targetQuery, payload) {
    if (targetQuery === this.query) {
      if (!this.allArgsSelected) {
        this.allArgsSelected = true;
        for(let arg of this) {
          arg.selectAllQueryArgs(targetQuery, payload);
        }
      }
    } else {
      for(let arg of this) {
        arg.selectAllQueryArgs(targetQuery, payload);
      }
    }
  }


  doesQueryHaveVF(VFName) {
    let argType, query, resp = false;
    for(let arg of this) {
      ({ [CLASS_PROP]: argType } = arg);
      if (argType === ARG_VF_QUERY) {
        ({ query } = arg);
        if (arg.VFName === VFName && query.queryArgs) {
          resp = true;
          break;
        }
      } else if (argType === ARG_GROUPED_QUERY) {
        ({ query } = arg);
        if (query) {
          resp = query.doesQueryHaveVF(VFName);
          if (resp) {
            break;
          }
        }
      }
    }
    return resp;
  }

  addIncludeVFFromArgs(VFName, builder, nextJoin) {
    let argType, join, queryArgs, query;
    for(let arg of this) {
      ({ [CLASS_PROP]: argType, join } = arg);
      if (join) {
        if (join === 'or') {
          nextJoin = 'or';
        } else if (!nextJoin) {
          nextJoin = 'and';
        }
      }
      if (argType === ARG_VF_QUERY) {
        if (arg.VFName === VFName) {
          ({ query } = arg);
          if (query && query.queryArgs) {
            switch(nextJoin) {
              case 'and':
                builder.andWhere(query);
                break;
              case 'or':
                builder.orWhere(query);
                break;
              default:
                builder.where(query);
            }
            nextJoin = false;
          }
        }
      } else if (argType === ARG_GROUPED_QUERY) {
        ({ query } = arg);
        if (query && query.doesQueryHaveVF(VFName)) {
          switch(nextJoin) {
            case 'and':
              builder.andWhere(
                groupedBuilder => query.queryArgs.addIncludeVFFromArgs(VFName, groupedBuilder)
              );
              break;
            case 'or':
              builder.orWhere(
                groupedBuilder => query.queryArgs.addIncludeVFFromArgs(VFName, groupedBuilder)
              );
              break;
            default:
              builder.where(
                groupedBuilder => query.queryArgs.addIncludeVFFromArgs(VFName, groupedBuilder)
              );
              break;
          }
        }
      }
    }
    builder.selectAllQueryArgs();
  }

  isDifferentThan(otherQueryArgs) {
    const { length } = this;
    if (otherQueryArgs.length !== length) {
      return true;
    }
    let arg1, arg2;
    for(let i = 0; i < length; i++) {
      arg1 = this[i];
      arg2 = otherQueryArgs[i];
      if (arg1.isDifferentThan(arg2)) {
        return true;
      }
    }
    return false;
  }

}

Object.defineProperty(QueryArgs, CLASS_PROP, { value: QUERY_ARGS });
Object.defineProperty(QueryArgs.prototype, CLASS_PROP, { value: QUERY_ARGS });
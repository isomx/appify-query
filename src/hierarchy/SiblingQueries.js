import {
  ARG_VF_QUERY, ARG_GROUPED_QUERY, CLASS_PROP
} from "../constants/objectTypes";

export function getCommonAncestorArg(query1, query2) {
  const { ancestorArgs: args1 } = query1,
    { ancestorArgs: args2 } = query2;
  if (!args1 || !args2) {
    return null;
  }
  for(let i = 0; i < args1.length; i++) {
    if (args1[i] !== args2[i]) {
      return args1[i - 1];
    }
  }
  return null;
}

const commonArgsLoop = (commonArgs, startIdx, stopIdx) => {
  while(startIdx <= stopIdx) {
    // if it is "and" or undefined (the first .where()), we continue.
    if (commonArgs[startIdx].join === 'or') {
      return false;
    }
    startIdx++;
  }
  return true;
}

/**
 *
 * @param {QueryWithHierarchy} query1
 * @param {QueryWithHierarchy} query2
 * @returns {boolean}
 */
function canSiblingsShare(query1, query2) {
  if (
    query1.modelName !== query2.modelName
    || query1.isQueryInPath(query2)
    || query2.isQueryInPath(query1)
  ) {
    return false;
  }
  const commonArg = getCommonAncestorArg(query1, query2);
  if (!commonArg) {
    if (query1.isNestedVFGroup || query2.isNestedVFGroup) {
      /**
       * It might be possible to still share constraints, but
       * only if you're querying like an asshole
       * Ex:
       * .where('user', query => query
       *    .where('address', query => query
       *        .where('city', 'homeBoyTown')
       *    )
       * )
       * .andWhere('user, query => query
       *    .where('address', query => query
       *        .where('state', 'VA')
       *    )
       * )
       *
       * ...we're not going to run checks to try to handle
       * that nonsense. The moment there are any arguments
       * within either "user" virtual field queries you could no
       * longer share constraints between the "address" virtual fields queries.
       * So other than the above ridiculous example, you can't
       * share constraints between nested VF queries.
       */
      return false;
    } else {
      return true;
    }
  }
  /**
   * So we have a common ancestor, we know we aren't in a
   * parent->child or child->parent relationship, so we
   * we need to see if between the common ancestor and our argument
   * there are any "or's". If so, we do not want to share.
   *
   * We know the commonArg, so we take the index of the commonArg
   * in each of the ancestor arrays and add 1. That will give us
   * each of the args within the shared group. Then we get each of those
   * args indices and just loop through the args in between. If
   * any are not "and" then we cannot share.
   *
   * Note that the commonArg will have to be a grouped query or
   * VFQuery. So we want that query's queryArgs. The commonArg
   * is actually the arg on the query above it that contains
   * this common group.
   */
  const { query: { queryArgs: commonQueryArgs } } = commonArg,
    { ancestorArgs: siblingAncestors } = query2,
    { ancestorArgs: ownAncestors } = query1;
  let idx1 = siblingAncestors[siblingAncestors.indexOf(commonArg) + 1].argIdx,
    idx2 = ownAncestors[ownAncestors.indexOf(commonArg) + 1].argIdx;
  return idx1 < idx2 ? commonArgsLoop(commonQueryArgs, idx1, idx2)
    : commonArgsLoop(commonQueryArgs, idx2, idx1);
}

class SiblingQueriesGroup extends Array {
  constructor(controller, siblingGroupIdx) {
    super();
    this.controller = controller;
    this.siblingGroupIdx = siblingGroupIdx;
  }

  _registerSibling(sibling) {
    const { length } = this;
    let ownSiblingsIdx, newSiblingsIdx, i = 0;
    for(let query of this) {
      if (canSiblingsShare(query, sibling)) {
        ({ ownSiblingsIdx } = query);
        if (ownSiblingsIdx) {
          ownSiblingsIdx.push(length);
        } else {
          query.ownSiblingsIdx = [ length ];
        }
        if (newSiblingsIdx) {
          newSiblingsIdx.push(i);
        } else {
          newSiblingsIdx = [ i ];
        }
      }
      i++;
    }
    this.push(sibling);
    sibling.siblingQueriesIdx = length;
    sibling.ownSiblingsIdx = newSiblingsIdx;
    sibling.siblingQueries = this;
    sibling.siblingQueriesGroupIdx = this.siblingGroupIdx;
  }

  registerSibling(sibling) {
    this.controller.registerSibling(sibling);
  }

  _deRegisterSibling(sibling) {
    const removedIdx = this.indexOf(sibling);
    if (removedIdx < 0) {
      return;
    }
    let ownSiblingsIdx, i, idx, length;
    for(let query of this) {
      ({ ownSiblingsIdx } = query);
      if (ownSiblingsIdx) {
        length = ownSiblingsIdx.length;
        i = 0;
        while(i < length) {
          idx = ownSiblingsIdx[i];
          if (idx === removedIdx) {
            ownSiblingsIdx.splice(i, 1);
            length--;
          } else {
            if (idx > removedIdx) {
              ownSiblingsIdx[i] = idx - 1;
            }
            i++;
          }
        }
      }
    }
    this.splice(removedIdx, 1);
    /**
     * We need to recurse if this sibling's queryArgs
     * have any groupedQueries or VFQueries,
     * since those would also be in our array.
     * _deRegisterSibling() is only called
     * when an arg is removed/replaced, which
     * means any of its nested args will also
     * be invalid and must be removed. The
     * query may just be getting moved, but even
     * then a new instance will be created to
     * contain the data for the query, in which
     * case it will be re-added to siblings.
     */
    const { queryArgs } = sibling;
    if (queryArgs) {
      let argType;
      for(let arg of queryArgs) {
        ({ [CLASS_PROP]: argType } = arg);
        if (argType === ARG_VF_QUERY || argType === ARG_GROUPED_QUERY) {
          this._deRegisterSibling(arg.query);
        }
      }
    }
  }

  deRegisterSibling(sibling) {
    this.controller.deRegisterSibling(sibling);
  }
}

export class SiblingQueries extends Array {
  constructor(topLevelQuery) {
    super();
    this.query = topLevelQuery;
  }

  registerSibling(sibling) {
    const { topLevelQueryArg } = sibling;
    const { argsGroupIdx } = topLevelQueryArg;
    let siblingQueryArgs = this[argsGroupIdx];
    if (siblingQueryArgs) {
      siblingQueryArgs._registerSibling(sibling);
    } else {
      this[argsGroupIdx] = siblingQueryArgs = new SiblingQueriesGroup(this, argsGroupIdx);
      siblingQueryArgs._registerSibling(sibling);
    }
  }

  deRegisterSibling(sibling) {
    const { topLevelQueryArg } = sibling;
    if (topLevelQueryArg) {
      const { argsGroupIdx } = topLevelQueryArg;
      const siblingQueryArgs = this[argsGroupIdx];
      if (siblingQueryArgs) {
        siblingQueryArgs._deRegisterSibling(sibling);
      }
    }
  }

  static init(query) {
    return new this(query);
  }
}
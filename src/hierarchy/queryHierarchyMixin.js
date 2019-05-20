import { SiblingQueries } from "./SiblingQueries";
import { VF_QUERY } from "../constants/instanceTypes";
import {
  ARG_VF_QUERY, ARG_GROUPED_QUERY, CLASS_PROP
} from "../constants/objectTypes";

/**
 * Extends Query to provide hierarchy functionality
 * @param {Query} superclass
 * @returns {QueryWithHierarchy}
 */
export const queryHierarchyMixin = superclass => {

  /**
   * @class QueryWithHierarchy
   * @extends Query
   */
  class QueryWithHierarchy extends superclass {

    convertToGroupedQuery(parent, parentQueryArgIdx) {
      /**
       * See notes in mergeQuery() method. In short, if we exist
       * in siblingQueries we have to deRegister ourselves
       * since our siblings could change as a result of
       * becoming a groupedQuery on the new instance.
       */
      if (this.siblingQueries) {
        this.siblingQueries.deRegisterSibling(this);
      }
      return super.convertToGroupedQuery(parent, parentQueryArgIdx);
    }

    mergeQuery(query, join) {
      /**
       * We have to deRegister ourselves from sibling queries
       * if we exist in siblingQueries since we are no
       * longer on the same plane as we were since we
       * are going to become a group within the new query instance.
       * Our new ownSiblingsIdx array will be recalculated when
       * the groupedQuery is created from our existing query.
       */
      if (this.siblingQueries) {
        this.siblingQueries.deRegisterSibling(this);
      }
      return super.mergeQuery(query, join);
    }

    removeQueryArg(argOrIdx) {
      if (!this.siblingQueries) {
        return super.removeQueryArg(argOrIdx);
      }
      /**
       * If the removed argument is a grouped || VFQueryArg argument
       * then we need to de-register it from siblingQueries.
       */
      const { queryArgs } = this;
      if (queryArgs) {
        const removedArg = queryArgs.removeArg(argOrIdx);
        if (removedArg) {
          const { [CLASS_PROP]: argType } = removedArg;
          if (argType === ARG_VF_QUERY || argType === ARG_GROUPED_QUERY) {
            this.siblingQueries.deRegisterSibling(removedArg.query);
          }
        }
      }
      return this;
    }

    replaceQueryArg(argOrIdx, newArg) {
      if (!this.siblingQueries) {
        return super.replaceQueryArg(argOrIdx, newArg);
      }

      /**
       * If the removed argument is a grouped || VFQueryArg argument
       * then we need to de-register it from siblingQueries.
       */
      const { queryArgs } = this;
      if (queryArgs) {
        const removedArg = queryArgs.replaceArg(argOrIdx, newArg);
        if (removedArg) {
          const { [CLASS_PROP]: argType } = removedArg;
          if (argType === ARG_VF_QUERY || argType === ARG_GROUPED_QUERY) {
            this.siblingQueries.deRegisterSibling(removedArg.query);
          }
        }
      }
    }

    setAsVFQuery(parentArg) {
      super.setAsVFQuery(parentArg);
      this.registerSibling(this);
      return this;
    }

    setAsGroupedQuery(parentArg) {
      super.setAsGroupedQuery(parentArg);
      this.registerSibling(this);
      return this;
    }

    registerSibling(sibling) {
      let { siblingQueries } = this;
      if (!siblingQueries) {
        if (this.parentMethodsMap.registerSibling) {
          this.parent.registerSibling(sibling, true);
        } else {
          // we are the top-level query, and this is the
          // first sibling ever created.
          this.siblingQueries = siblingQueries = SiblingQueries.init(this);
          siblingQueries.registerSibling(sibling);
        }
      } else {
        siblingQueries.registerSibling(sibling);
      }
    }


    isQueryInPath(query) {
      if (query === this) {
        return true;
      } else if (this.parent) {
        return this.parent.isQueryInPath(query);
      } else {
        return false;
      }
    }

    get ancestorArgs() {
      let { _ancestorArgs } = this;
      if (_ancestorArgs) {
        return _ancestorArgs;
      }
      let { parentQueryArg } = this;
      if (!parentQueryArg || this.isIncludeVF) {
        // there are no parents
        return _ancestorArgs;
      }
      this._ancestorArgs = _ancestorArgs = [];
      let ownQuery;
      while(parentQueryArg) {
        _ancestorArgs.unshift(parentQueryArg);
        ({ ownQuery } = parentQueryArg);
        if (ownQuery.isIncludeVF) {
          break;
        }
        ({ parentQueryArg } = ownQuery);
      }
      return _ancestorArgs;
    }

    /**
     * Used by SiblingQueries to determine what siblingQueriesGroup
     * to place the sibling in. Siblings are only shared within
     * a group/VF query or in unbroken "and" chains in the top-level query.
     * @returns {*}
     */
    get topLevelQueryArg() {
      if (this.isIncludeVF) {
        // if this is an includeVF then it is the top-level query
        // as far as this is concerned.
        return null;
      }
      const { parent } = this;
      if (parent) {
        let arg = parent.topLevelQueryArg;
        if (arg === null) {
          // we are only 1 deep, so our parentQueryArg is the arg
          // on the topLevel query.
          arg = parent.queryArgs[this.parentQueryArgIdx];
        }
        return arg;
      } else {
        return null;
      }
    }

    __isNestedVFGroup() {
      if (this.instanceType === VF_QUERY) {
        return true;
      }
      if (this.parent && !this.isIncludeVF) {
        return this.parent.__isNestedVFGroup();
      }
      return false;
    }

    get isNestedVFGroup() {
      if (this.instanceType !== VF_QUERY) {
        return false;
      }
      return this.parent.__isNestedVFGroup();
    }

    get parent() {
      return this._parent;
    }

    set parent(parent) {
      if (parent !== this._parent) {
        this._ancestorArgs = undefined;
      }
      this._parent = parent;
    }
  }
  return QueryWithHierarchy;
}
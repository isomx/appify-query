import QueryArgs from '../queryArgs';
import SelectField from '../selectField';
import IncludeVF from '../includeVF';
import RecordResult from '../recordResult';
import { getValueParam } from '../utils/params';
import {
  isIncludeVFArg,
  isQuery,
  isSelectField
} from "../utils/objectTypes";
import addDirective from '../directives/addDirective';
import areDirectivesDifferent from '../directives/areDirectivesDifferent';
import cloneDirectives from '../directives/cloneDirectives';
import mergeDirectives from '../directives/mergeDirectives';
import formatResponse from '../utils/formatResponse';
import {
  MAIN_QUERY,
  GROUPED_QUERY,
  VF_QUERY,
  INCLUDE_VF_QUERY
} from "../constants/instanceTypes";
import {
  CLASS_PROP,
  QUERY
} from "../constants/objectTypes";
import {
  OBJECT,
  ARRAY,
  SINGLE
} from "../constants/responseFormatTypes";
import {
  RECORDS,
  RECORDS_RESULTS
} from "../constants/responseFormats";
import {
  parentPropsConfig,
  parentMethodsConfig
} from "./config";

/**
 * @class Query
 */
export default class Query {
  static QueryArgs = QueryArgs;
  static SelectField = SelectField;
  static IncludeVF = IncludeVF;
  static RecordResult = RecordResult;
  static parentPropsConfig = parentPropsConfig;
  static parentMethodsConfig = parentMethodsConfig;

  constructor(instanceType) {
    this.instanceType = instanceType;
    this.directives = undefined;
    this.directiveVariables = undefined;
    this.directiveDefaults = undefined;
    this.allQueryArgsSelected = false;
  }

  static init(model) {
    const instance = new this(MAIN_QUERY);
    instance.model = model;
    instance.parent = false;
    return instance;
  }

  static initNewInstance(instanceType, query, parent, parentQueryArgIdx) {
    const instance = new this(instanceType);
    switch(instanceType) {
      case MAIN_QUERY:
        instance.model = query.model;
        instance.queryName = query.queryName;
        instance.parent = parent;
        instance.parentQueryArgIdx = parentQueryArgIdx;
        break;
      case GROUPED_QUERY:
        instance.setAsGroupedQuery(parent.queryArgs[parentQueryArgIdx]);
        break;
      case INCLUDE_VF_QUERY:
        instance.setAsIncludeVF(parent.includeVFs[parentQueryArgIdx]);
        instance.model = query.model;
        instance.queryName = query.queryName;
        break;
      case VF_QUERY:
        instance.setAsVFQuery(parent.queryArgs[parentQueryArgIdx]);
        instance.queryName = query.queryName;
        instance.model = query.model;
        break;
      default:
        throw new Error('Unrecognized instanceType. Got: ' + instanceType);
    }
    return instance;
  }

  createNewInstance(instanceType, parent, parentQueryArgIdx) {
    if (!instanceType) {
      ({ instanceType, parent, parentQueryArgIdx } = this);
    }
    return this.constructor.initNewInstance(
      instanceType, this, parent, parentQueryArgIdx
    );
  }

  /**
   * If no parent is provided it will assume that the
   * query is to become a MAIN_QUERY. So this can be used
   * to convert a non-MAIN_QUERY into a MAIN_QUERY.
   * @param {?Query=} [parent = undefined]
   * @param {?string=|?number=} [parentQueryArgIdx = undefined]
   * @param {?string=} [overrideType = undefined] - If parent is provided,
   * overrideType can also be provided to change the type of
   * query that will be populated with this query's current data.
   * For example, you can convert an includeVF query into a groupedQuery
   * by providing a parent/parentQueryArgIdx and then GROUPED_QUERY
   * as the override type. Note that an overrideType cannot be provided
   * without the parentQueryArgIdx parameter.
   * @returns {Query}
   */
  clone(parent, parentQueryArgIdx, overrideType) {
    let { instanceType } = this;
    if (parent) {
      if (typeof parentQueryArgIdx === 'undefined') {
        parentQueryArgIdx = this.parentQueryArgIdx;
        if (typeof parentQueryArgIdx === 'undefined') {
          throw new Error('Missing required parentQueryArgIdx.');
        }
      } else if (overrideType) {
        instanceType = overrideType;
      }
    } else {
      instanceType = MAIN_QUERY;
    }
    const newInstance = this.createNewInstance(
      instanceType, parent, parentQueryArgIdx
    );
    newInstance.buildFromQuery(this);
    return newInstance;
  }

  convertToGroupedQuery(parent, parentQueryArgIdx) {
    let { instanceType } = this, instance;
    if (!parent) {
      /**
       * If no parent is provided then we assume we
       * are keeping the same parent information, but then
       * just nesting our query into a grouped query with the
       * new grouped query's parent being the newly created
       * instance. If we are not a child already, then we
       * are a top-level query that is nesting its query
       * into a group. So check if parentQueryArg even exists.
       */
      const { parentQueryArg } = this;
      if (parentQueryArg) {
        parent = parentQueryArg.ownQuery;
        parentQueryArgIdx = parentQueryArg.argIdx;
      }
    } else if (typeof parentQueryArgIdx === 'undefined') {
      parentQueryArgIdx = this.parentQueryArgIdx;
    }
    instance = this.createNewInstance(instanceType, parent, parentQueryArgIdx);
    instance.where(this);
    return instance;
  }


  addSelectFromQuery(query) {
    const { querySelect } = query;
    if (querySelect) {
      if (this.querySelect || this.isGroupedQuery) {
        this.mergeSelect(querySelect);
      } else if (!this.isVFGroup) {
        const newQuerySelect = {};
        this.querySelect = newQuerySelect;
        for(let key in querySelect) {
          newQuerySelect[key] = querySelect[key].clone(this);
        }
      }
    }
    return this;
  }

  addIncludeVFsFromQuery(query) {
    const { includeVFs } = query;
    if (includeVFs) {
      if (this.includeVFs || this.isGroupedQuery) {
        this.mergeIncludeVFs(includeVFs);
      } else if (!this.isVFGroup) {
        const newIncludeVFs = {};
        this.includeVFs = newIncludeVFs;
        /**
         * You have to let the includeVF add itself
         * to includeVFs because the new instance needs
         * to exist on the includeVFs object before
         * it can clone its query. So we can't wait for
         * it to be returned from the includeVF.
         *
         * Also (only applies to Model), but if the
         * includeVF is a manyToMany, and we are cloning
         * because it is building an execution query, the
         * includeVF may switch the includeVF
         * with the throughModel VF, nesting its current
         * includeVF on the throughModel VF query so that
         * it executes on the server correctly
         */
        for(let key in includeVFs) {
          includeVFs[key].clone(this, newIncludeVFs);
        }
      }
    }
    return this;
  }

  addQueryArgsFromQuery(query) {
    const { queryArgs } = query;
    if (queryArgs) {
      if (this.queryArgs) {
        this.queryArgs.mergeArgs(queryArgs);
      } else {
        this.queryArgs = this.constructor.QueryArgs.init(this);
        queryArgs.clone(this);
      }
    }
    return this;
  }

  addDirectivesFromQuery(query) {
    if (this.directives) {
      mergeDirectives(this, query);
    } else {
      cloneDirectives.call(this, query);
    }
    return this;
  }

  /**
   * This builds the query based on the provided query. Note that
   * this will not change the instanceType of this query. So buildFromQuery()
   * should be called after initializing the type of query that is
   * desired. It won't try to "become" whatever the passed in query is.
   * It will just clone select, includeVFs, queryArgs, and directives,
   * and those will then realign to be tied to this query.
   * @param {Query} query
   * @returns {Query}
   */
  buildFromQuery(query) {
    this.addSelectFromQuery(query);
    this.addIncludeVFsFromQuery(query);
    this.addQueryArgsFromQuery(query);
    this.addDirectivesFromQuery(query);
    this.queryAlias = query.queryAlias;
    return this;
  }

  mergeQuery(query, join) {
    const { instanceType, parentQueryArg } = this;
    const instance = !parentQueryArg ? this.createNewInstance(instanceType)
      : this.createNewInstance(instanceType, parentQueryArg.ownQuery, parentQueryArg.argIdx);
    if (join === 'and') {
      instance.where(this).andWhere(query);
    } else {
      instance.where(this).orWhere(query);
    }
    return instance;
  }

  setAsVFQuery(parentArg) {
    this.instanceType = VF_QUERY;
    this.parent = parentArg.ownQuery;
    this.parentQueryArgIdx = parentArg.argIdx;
    parentArg.VFQuery = this;
    return this;
  }

  setAsIncludeVF(parentArg) {
    this.instanceType = INCLUDE_VF_QUERY;
    this.parent = parentArg.ownQuery;
    this.parentQueryArgIdx = parentArg.argIdx;
    parentArg.query = this;
    return this;
  }

  setAsGroupedQuery(parentArg) {
    this.instanceType = GROUPED_QUERY;
    this.parent = parentArg.ownQuery;
    this.parentQueryArgIdx = parentArg.argIdx;
    parentArg.groupedQuery = this;
    return this;
  }

  createGroupedInstance(parentArg) {
    return this.createNewInstance(GROUPED_QUERY, this, parentArg.argIdx);
  }

  get RecordResult() {
    return RecordResult;
  }

  get parent() {
    return this._parent;
  }

  set parent(parent) {
    this._parent = parent;
  }

  get model() {
    return this.parentPropsMap.model ? this.parent.model
      : this._model;
  }

  set model(model) {
    if (this.parentPropsMap.model) {
      this.parent.model = model;
    } else {
      this._model = model;
    }
  }

  get queryHasVariables() {
    return this._queryHasVariables;
  }

  set queryHasVariables(bool) {
    this._queryHasVariables = bool;
    /**
     * If true, and we have a parent,
     * run up the chain so the
     * top-level knows that somewhere in its
     * children there are variables in the query.
     */
    if (bool && this.parent) {
      this.parent.queryHasVariables = true;
    }
  }

  get queryHasVF() {
    return this._queryHasVF;
  }

  set queryHasVF(bool) {
    this._queryHasVF = bool;
    /**
     * If true, and we have a parent,
     * and we aren't an includeVF, run up the
     * chain so the top-level knows that somewhere in its
     * children there are is a VF in the query.
     */
    if (bool && this.parentPropsMap.queryHasVF) {
      this.parent.queryHasVF = true;
    }
  }

  /**
   *
   * @param {Query} childQuery
   * @param {?boolean=} [ifSameParent = false] - If true, the parentArg will
   * only be returned if this instance is the parent of the child. The
   * reason ifSameParent is false by default is because this method
   * is most useful for determining whether or not a child has been
   * cloned. And if so, get the cloned/original instance.
   * Otherwise childQuery.parentArg could just be used instead.
   * @returns {GroupedQueryArg|IncludeVF|VFQueryArg|undefined}
   */
  getChildQueryArg(childQuery, ifSameParent) {
    const { instanceType, parentQueryArgIdx } = childQuery;
    if (ifSameParent && childQuery.parent !== this) {
      return undefined;
    }
    let arg;
    if (instanceType === INCLUDE_VF_QUERY) {
      const { includeVFs } = this;
      if (includeVFs) {
        ({ [parentQueryArgIdx]: arg } = includeVFs);
      }
    } else if (instanceType === GROUPED_QUERY || instanceType === VF_QUERY) {
      const { queryArgs } = this;
      if (queryArgs) {
        arg = queryArgs[parentQueryArgIdx];
      }
    } else {
      throw new Error('A valid child instanceType must be provided if ' +
        'the child\'s parentQueryArgIdx is provided. Got: ' + childQuery);
    }
    return arg;
  }

  /**
   * Finds the closest INCLUDE_VF_QUERY or MAIN_QUERY in the query
   * hierarchy. Useful when building queries that rely on parent
   * settings so it is not necessary to know ahead of time how many
   * levels deep you might be (i.e., groupedQuery)
   * @returns {Query}
   */
  getClosestIncludeOrMainQuery() {
    const { instanceType } = this;
    if (instanceType === INCLUDE_VF_QUERY || instanceType === MAIN_QUERY) {
      return this;
    } else {
      return this.parent.getClosestIncludeOrMainQuery();
    }
  }

  get parentQueryArg() {
    const { parent } = this;
    if (parent) {
      const { instanceType } = this;
      if (instanceType === GROUPED_QUERY || instanceType === VF_QUERY) {
        return parent.queryArgs[this.parentQueryArgIdx];
      } else if (instanceType === INCLUDE_VF_QUERY) {
        return parent.includeVFs[this.parentQueryArgIdx];
      } else {
        throw new Error('Unrecognized instanceType. Cannot retrieve the parentQueryArg.');
      }
    }
    return undefined;
  }

  get instanceType() {
    return this._instanceType;
  }

  set instanceType(type) {
    this._instanceType = type;
    this.parentPropsMap = this.constructor.parentPropsConfig[type];
    this.parentMethodsMap = this.constructor.parentMethodsConfig[type];
  }

  get isMainQuery() {
    return this.instanceType === MAIN_QUERY;
  }

  /**
   * @deprecated
   * @returns {boolean}
   */
  get isRootQuery() {
    throw new Error('isRootQuery is deprecated. Use isMainQuery() instead.');
  }

  get isGroupedQuery() {
    return this.instanceType === GROUPED_QUERY;
  }

  get isVFGroup() {
    return this.instanceType === VF_QUERY;
  }

  get isIncludeVF() {
    return this.instanceType === INCLUDE_VF_QUERY;
  }

  get queryName() {
    return this.parentPropsMap.queryName ? this.parent.queryName
      : this._queryName;
  }

  set queryName(name) {
    if (this.parentPropsMap.queryName) {
      // only pass up to parent if it doesn't already
      // have a name associated with it.
      if (!this.parent.queryName) {
        this.parent.queryName = name;
      }
    } else {
      this._queryName = name;
    }
  }

  getValueParam(val) {
    // format = :paramVal
    const resp = getValueParam(val);
    if (resp) {
      this.queryHasVariables = true;
    }
    return resp;
  }

  modelHasField(name) {
    return true;
  }

  _selectSingle(value, querySelect, SelectField) {
    const typeofValue = isSelectField(value) ? 'SelectField' : typeof value;
    let field, name;
    switch(typeofValue) {
      case 'function':
        field = SelectField.init(this);
        field = value(field);
        ({ name } = field);
        if (this.modelHasField(name)) {
          if (querySelect) {
            querySelect[name] = field;
          } else {
            this.querySelect = querySelect = { [name]: field };
          }
        }
        break;
      case 'string':
        if (this.modelHasField(value)) {
          if (querySelect) {
            ({ [value]: field } = querySelect);
            if (!field) {
              field = SelectField.init(this);
              field.name = value;
              querySelect[value] = field;
            }
          } else {
            field = SelectField.init(this);
            field.name = value;
            this.querySelect = querySelect = { [value]: field };
          }
        }
        break;
      case 'SelectField':
        name = value.name;
        if (querySelect) {
          ({ [name]: field } = querySelect);
          if (field) {
            field.merge(value);
          } else {
            querySelect[name] = value.clone(this);
          }
        } else {
          this.querySelect = querySelect = { [name]: value.clone(this) };
        }
        break;
      case 'object':
        let alias;
        for(name in value) {
          alias = value[name];
          if (this.modelHasField(name)) {
            if (querySelect) {
              ({ [name]: field } = querySelect);
            } else {
              this.querySelect = querySelect = {};
            }
            if (field) {
              field.alias = alias;
            } else {
              field = SelectField.init(this);
              field.name = name;
              field.alias = alias;
              querySelect[name] = field;
            }
          }
        }
        break;
      default:
        throw new Error('Unknown value type. Expected string, object or ' +
          'function. Got: ' + typeofValue);
    }
    return querySelect;
  }

  select(values) {
    if (this.parentMethodsMap.select) {
      this.parent.select(values);
    } else {
      let { querySelect } = this;
      const { SelectField } = this.constructor;
      if (Array.isArray(values)) {
        for(let value of values) {
          querySelect = this._selectSingle(value, querySelect, SelectField);
        }
      } else {
        this._selectSingle(values, querySelect, SelectField);
      }
    }
    return this;
  }

  mergeSelect(sourceSelect) {
    if (sourceSelect) {
      if (this.parentMethodsMap.select) {
        this.parent.mergeSelect(sourceSelect);
      } else {
        let { querySelect } = this;
        if (!querySelect) {
          this.querySelect = querySelect = {};
        }
        const { SelectField } = this.constructor;
        for(let fieldName in sourceSelect) {
          this._selectSingle(sourceSelect[fieldName], querySelect, SelectField);
        }
      }
    }
    return this;
  }

  isFieldSelected(name) {
    if (this.parentMethodsMap.select) {
      return this.parent.isFieldSelected(name);
    } else {
      return !!(this.querySelect && this.querySelect[name]);
    }
  }

  /**
   * Removes provided keys from select, or if not === true,
   * it will remove any keys that are not in the array
   * @param {Array|string} keys - the keys to remove/whitelist
   * @param {?boolean=} [not = false] - If true, only the
   * keys will be left in select
   * @returns {Query}
   */
  deSelect(keys) {
    if (this.parentMethodsMap.select) {
      this.parent.deSelect(keys);
      return this;
    }
    const { querySelect } = this;
    if (!querySelect) {
      return this;
    }
    if (!Array.isArray(keys)) {
      keys = [ keys ];
    }
    /**
     * Don't initialize new object. We may be removing everything.
     */
    let length = keys.length, newQuerySelect, not;
    if (typeof keys[length - 1] === 'boolean') {
      not = keys.pop();
      length--;
    }
    if (length < 1) {
      return this;
    }
    if (not) {
      for(let name in querySelect) {
        if (keys.indexOf(name) > -1) {
          if (!newQuerySelect) newQuerySelect = {};
          newQuerySelect[name] = querySelect[name];
        }
      }
    } else {
      for(let name in querySelect) {
        if (keys.indexOf(name) < 0) {
          if (!newQuerySelect) newQuerySelect = {};
          newQuerySelect[name] = querySelect[name];
        }
      }
    }
    // could be undefined if we removed everything.
    this.querySelect = newQuerySelect;
    return this;
  }

  deSelectAll() {
    if (this.parentMethodsMap.select) {
      this.parent.deSelectAll();
    } else {
      this.querySelect = undefined;
    }
    return this;
  }

  /**
   * Makes sure that all arguments in queryArgs & includeVFs
   * are selected so that a query can be resolved locally
   * @param {?Query=} [targetQuery = this]
   * @param {?Query=} [sourceQuery = this]
   * @returns {Query}
   */
  selectAllQueryArgs(targetQuery, sourceQuery, payload) {
    if (!sourceQuery) {
      sourceQuery = this;
    }
    if (!targetQuery) {
      targetQuery = this;
    }
    if (targetQuery === this && sourceQuery === this) {
      if (this.allQueryArgsSelected) {
        /**
         * We are the target and the source, and since
         * allQueryArgsSelected === true, we know that
         * any changes would have already been automatically
         * added to select. So we don't need to parse everything
         * again.
         */
        return this;
      } else {
        this.allQueryArgsSelected = true;
      }
    }
    const { queryArgs, includeVFs } = sourceQuery;
    if (queryArgs) {
      queryArgs.selectAllQueryArgs(targetQuery, payload);
    }
    if (includeVFs) {
      for(let key in includeVFs) {
        includeVFs[key].selectAllQueryArgs(targetQuery, payload);
      }
    }
    return this;
  }

  _getOrInitIncludeVF(VFName) {
    let { includeVFs } = this, includeVF;
    if (includeVFs) {
      ({ [VFName]: includeVF } = includeVFs);
      if (!includeVF) {
        includeVFs[VFName] = includeVF =
          this.constructor.IncludeVF.init(this, VFName);
      }
    } else {
      this.includeVFs[VFName] = includeVF =
        this.constructor.IncludeVF.init(this, VFName);
    }
    return includeVF;
  }

  includeAll(VFName, fieldsOrKeepSelect, payload) {
    if (this.parentMethodsMap.include) {
      this.parent.includeAll(VFName, fieldsOrKeepSelect, payload);
    } else {
      const includeVF = this._getOrInitIncludeVF(VFName, payload);
      includeVF.includeAll(fieldsOrKeepSelect, payload);
    }
    return this;
  }

  includeAtPath(fieldsOrFnOrQueryOrIncludeVFArg, thisArgOrPath, pathOrPayload, payload, _idx) {
    if (this.parentMethodsMap.include) {
      this.parent.includeAtPath(
        fieldsOrFnOrQueryOrIncludeVFArg, thisArgOrPath, pathOrPayload, payload, _idx
      );
      return this;
    }
    let path, thisArg;
    if (!_idx) {
      _idx = 0;
      if (!payload) {
        if (!pathOrPayload) {
          if (!Array.isArray(thisArgOrPath)) {
            throw new Error('A path array must be provided to includeAtPath(). Got: ' + thisArgOrPath);
          }
          // there is no payload or thisArg. Just a path was provided.
          path = thisArgOrPath;
        } else if (Array.isArray(pathOrPayload)) {
          // a thisArg and path were provided, but no payload.
          path = pathOrPayload;
          thisArg = thisArgOrPath;
        } else {
          // pathOrPayload is the payload, so no thisArg was provided. Just path & payload.
          payload = pathOrPayload;
          path = thisArgOrPath;
          thisArg = undefined;
        }
      } else {
        // all arguments were provided
        path = pathOrPayload;
        thisArg = thisArgOrPath;
      }
    } else {
      // if _idx > 0, we have already normalized the arguments.
      thisArg = thisArgOrPath, path = pathOrPayload;
    }
    const includeVF = this._getOrInitIncludeVF(path[_idx], payload);
    if (includeVF) {
      includeVF.includeAtPath(fieldsOrFnOrQueryOrIncludeVFArg, thisArg, path, payload, _idx + 1);
    }
    return this;
  }

  includeFromQueryArgs(VFName, extraFieldsOrPayload, payload) {
    if (this.parentMethodsMap.include) {
      this.parent.includeFromQueryArgs(VFName, extraFieldsOrPayload, payload);
      return this;
    }
    if (this.doesQueryHaveVF(VFName)) {
      const includeVF = this._getOrInitIncludeVF(VFName, payload);
      if (!payload && extraFieldsOrPayload && !Array.isArray(extraFieldsOrPayload)) {
        payload = extraFieldsOrPayload;
        extraFieldsOrPayload = undefined;
      }
      /**
       * The query may not exist if we just initialized the includeVF.
       * But if extraFields are provided, a query will be created. So
       * we only need to check if there is no query if we aren't given
       * extraFields to include.
       */
      let { query } = includeVF;
      if (extraFieldsOrPayload) {
        includeVF.addSelect(extraFieldsOrPayload, payload);
      } else if (!query) {
        query = includeVF.createQueryInstance(payload);
      }
      /**
       * use "ownQuery" from includeVF in case a payload was provided and
       * this query was cloned
       */
      includeVF.ownQuery.queryArgs.addIncludeVFFromArgs(VFName, query);
    }
    return this;
  }

  /**
   * Includes a given VF so that it will be returned in the resulting query.
   * @param {string|IncludeVF} VFNameOrIncludeVFArg
   * @param {Array|function|Query|IncludeVF} fieldsOrFnOrQueryOrIncludeVFArg
   * The reason for also allowing an includeVF arg as the 2nd argument (instead
   * of just the 1st argument) is so that an includeVF's info can be re-used,
   * but the VFName for it can be changed. This is useful when dealing with
   * computed virtual fields (so not really applicable to this Core Query instance)
   * @param {boolean|Object|function} [fromOwnQueryOrThisArg = undefined] If
   * fieldsOrFnOrQueryOrIncludeVFArg is a function, a thisArg (object/function) can
   * be provided. If fieldsOrFnOrQueryOrIncludeVFArg is an array of select fields,
   * a boolean can be provided to signify that the query should be derived from
   * the queryArgs, which will then look for all VFQueries in the queryArgs for
   * the provided VFName, compile then together, and use that as the query. If
   * no VFQueries exist in QueryArgs for the provided VFName, the VF will not
   * be included.
   * @param {Object} [payload = undefined] - If provided, any changes or additions
   * will be payload-safe. Meaning a clone of the originalQuery will be created
   * if necessary, and the proper args will be selected to ensure the response
   * can be filtered locally. This is the responsibility of _getOrInitIncludeVF(),
   * so if this native version of querying is used, it will do nothing since
   * this native instance doesn't use a payload. Support for this parameter is
   * just meant to make extending this native version easier, same reason
   * _getOrInitIncludeVF() is called.
   * @returns {Query}
   */
  include(
    VFNameOrIncludeVFArg, fieldsOrFnOrQueryOrIncludeVFArg, fromOwnQueryOrThisArg, payload
  ) {
    if (this.parentMethodsMap.include) {
      this.parent.include(
        VFNameOrIncludeVFArg, fieldsOrFnOrQueryOrIncludeVFArg, fromOwnQueryOrThisArg
      );
      return this;
    }
    let includeVF;
    if (fromOwnQueryOrThisArg === true) {
      if (!this.doesQueryHaveVF(VFNameOrIncludeVFArg)) {
        return this;
      }
      includeVF = this._getOrInitIncludeVF(VFNameOrIncludeVFArg, payload);
      includeVF.addSelect(fieldsOrFnOrQueryOrIncludeVFArg, payload);
      const { query } = includeVF;
      // use "ownQuery" from includeVF in case a payload was provided and
      // this query was cloned.
      includeVF.ownQuery.queryArgs.addIncludeVFFromArgs(VFNameOrIncludeVFArg, query);
      console.log(' ');
      console.log('resulting query === ');
      console.log(query.convertToGraphql(true));
      return this;

    } else if (isIncludeVFArg(VFNameOrIncludeVFArg)) {
      includeVF = this._getOrInitIncludeVF(VFNameOrIncludeVFArg.VFName, payload);
      includeVF.merge(VFNameOrIncludeVFArg, payload);
    } else {
      /**
       * Use separate method to get the VF so that it isn't
       * necessary to overwrite this entire function just
       * to init the includeVF. This is useful when it comes
       * to ModelQuery since it saves the VF as the pkValue
       * of the ForeignField rather than the VFName.
       */
      includeVF = this._getOrInitIncludeVF(VFNameOrIncludeVFArg, payload);
      if (isIncludeVFArg(fieldsOrFnOrQueryOrIncludeVFArg)) {
        includeVF.merge(fieldsOrFnOrQueryOrIncludeVFArg, null, null, payload);
      } else {
        const typeofArg = isQuery(fieldsOrFnOrQueryOrIncludeVFArg) ? 'query'
          : typeof fieldsOrFnOrQueryOrIncludeVFArg;
        switch(typeofArg) {
          case 'query':
            // fromOwnQueryOrThisArg is not valid when a query is provided
            includeVF.addFromQuery(fieldsOrFnOrQueryOrIncludeVFArg, payload);
            break;
          case 'function':
            // fromOwnQueryOrThisArg must be a thisArg if it exists
            includeVF.addFromFn(fieldsOrFnOrQueryOrIncludeVFArg, fromOwnQueryOrThisArg, payload);
            break;
          default:
            includeVF.addSelect(fieldsOrFnOrQueryOrIncludeVFArg, payload);

        }
      }
    }
    return payload ? payload.query : this;
  }

  removeInclude(VFNameOrIncludeVFArg) {
    const { includeVFs } = this;
    if (includeVFs) {
      let VFName;
      if (typeof VFNameOrIncludeVFArg === 'string') {
        VFName = VFNameOrIncludeVFArg;
      } else if (!isIncludeVFArg(VFNameOrIncludeVFArg)) {
        throw new Error('Either a virtual field name (string) or an ' +
          'includeVF argument must be provided to remove the include.' +
          ' Got: ' + VFNameOrIncludeVFArg);
      } else {
        ({ VFName } = VFNameOrIncludeVFArg);
      }
      if (includeVFs[VFName]) {
        const { [VFName]: del, ...newIncludeVFs } = includeVFs;
        this.includeVFs = newIncludeVFs;
      }
    }
    return this;
  }

  mergeIncludeVFs(sourceIncludeVFs) {
    if (sourceIncludeVFs) {
      if (this.parentMethodsMap.include) {
        this.parent.mergeIncludeVFs(sourceIncludeVFs);
        return this;
      }
      let includeVF, sourceIncludeVF;
      for(let key in sourceIncludeVFs) {
        sourceIncludeVF = sourceIncludeVFs[key];
        includeVF = this._getOrInitIncludeVF(sourceIncludeVF.VFName);
        includeVF.merge(sourceIncludeVF);
      }
    }
  }

  doesQueryHaveVF(VFName) {
    return this.queryHasVF ? this.queryArgs.doesQueryHaveVF(VFName) : false;
  }

  isVFIncluded(VFName) {
    return this.includeVFs ? !!(this.includeVFs[VFName]) : false;
  }

  removeQueryArg(argOrIdx) {
    const { queryArgs } = this;
    if (!queryArgs) {
      return this;
    }
    queryArgs.removeArg(argOrIdx);
    return this;
  }

  replaceQueryArg(argOrIdx, newArg) {
    const { queryArgs } = this;
    if (!queryArgs) {
      return this;
    }
    queryArgs.replaceArg(argOrIdx, newArg);
    return this;
  }

  areQueryArgsDifferent(queryOrQueryArgs) {
    let otherQueryArgs = queryOrQueryArgs;
    if (isQuery(queryOrQueryArgs)) {
      ({ queryArgs: otherQueryArgs } = queryOrQueryArgs);
    }
    const { queryArgs } = this;
    if (queryArgs && otherQueryArgs) {
      if (queryArgs.isDifferentThan(otherQueryArgs)) {
        // console.warn('both queryArgs exist, but they are not the same... = ');
        // console.log({ queryArgs, otherQueryArgs });
        return true;
      }
    } else if (queryArgs || otherQueryArgs) {
      // console.warn('one query has queryArgs, the other does not...');
      return true;
    }
    return false;
  }

  /**
   * Compares 2 queries to determine if their includeVFs are
   * different.
   * @param {Query|Object} queryOrIncludeVFs - Either the other
   * query, or the other query's includeVFs
   * @param {?boolean=} [noSelect = false] - If true, the select
   * fields will not be compared
   * @returns {boolean} true if different, false if not.
   */
  areIncludesDifferent(queryOrIncludeVFs, noSelect) {
    let otherIncludeVFs = queryOrIncludeVFs;
    if (isQuery(queryOrIncludeVFs)) {
      ({ includeVFs: otherIncludeVFs } = queryOrIncludeVFs);
    }
    const { includeVFs } = this;
    if (otherIncludeVFs && includeVFs) {
      let includeVF, otherIncludeVF;
      for(let key in includeVFs) {
        ({ [key]: includeVF } = includeVFs);
        ({ [key]: otherIncludeVF } = otherIncludeVFs);
        if (includeVF && otherIncludeVF) {
          if (includeVF.isDifferentThan(otherIncludeVF, noSelect)) {
            // console.warn('includeVF is different = ', { includeVF, otherIncludeVF });
            return true;
          }
        } else if (!otherIncludeVF) {
          // console.warn('MISSING otherIncludeVF... key = ', key);
          return true;
        }
      }
    } else if (otherIncludeVFs || includeVFs) {
      // console.warn('one query has includeVFs, the other does not.');
      return true;
    }
    return false;
  }

  isSelectDifferent(queryOrQuerySelect) {
    let otherQuerySelect = queryOrQuerySelect;
    if (isQuery(queryOrQuerySelect)) {
      ({ querySelect: otherQuerySelect } = queryOrQuerySelect);
    }
    const { querySelect } = this;
    if (querySelect && otherQuerySelect) {
      let field, otherField;
      for(let key in querySelect) {
        ({ [key]: field } = querySelect);
        ({ [key]: otherField } = otherQuerySelect);
        if (field && otherField) {
          if (field.isDifferentThan(otherField)) {
            // console.warn('SELECT FIELD IS DIFFERENT');
            return true;
          }
        } else if (!otherField) {
          // console.warn('MISSING COMPARABLE SELECT FIELD');
          return true;
        }
      }
    } else if (querySelect || otherQuerySelect) {
      // console.warn('one query is missing querySelect entirely');
      return true;
    }
    return false;
  }

  areDirectivesDifferent(otherQuery) {
    if (areDirectivesDifferent(this, otherQuery)) {
      // console.warn('DIRECTIVES ARE DIFFERENT...');
      // console.log({ this: this, otherQuery });
      return true;
    } else {
      return false;
    }
  }

  isDifferentThan(otherQuery, noSelect) {
    return this.areQueryArgsDifferent(otherQuery)
      || this.areIncludesDifferent(otherQuery)
      || (!noSelect && this.isSelectDifferent(otherQuery))
      || this.areDirectivesDifferent(otherQuery);
  }

  /**
   *
   * @param {(string|function(Query): Query)} key
   * @param {?=} op
   * @param {?=} value
   * @param {boolean} not
   * @param {?string} join
   * @returns {Query}
   * @private
   */
  _addQueryArg(key, op, value, not, join) {
    if (this.parentMethodsMap.addQueryArg) {
      this.parent._addQueryArg(key, op, value, not, join);
      return this;
    }
    let { queryArgs } = this;
    if (queryArgs) {
      if (queryArgs.length === 0) {
        join = undefined;
      } else if (!join) {
        throw new Error('Use orWhere, andWhere, orWhereIn, andWhereIn, etc. ' +
          '(or the "not" variations) when chaining ' +
          'more than 1 where clause together.');
      }
      queryArgs.addArg(key, op, value, not, join);
    } else {
      join = undefined;
      this.queryArgs = queryArgs = this.constructor.QueryArgs.init(this);
      queryArgs.addArg(key, op, value, not, join);
    }
    return this;
  }

  /**
   * Updates all queryArgs & includeVFs queryArgs based on the
   * provide data object. If a key (or VFName) matches on
   * the data, the value of the arg will be updated, or its
   * value in the variables object will be updated if it is
   * an argument that uses a variable.
   * @param data
   * @param variables
   * @returns {Query}
   */
  updateQueryArgs(data, variables) {
    const { queryArgs } = this;
    if (queryArgs) {
      queryArgs.updateArgs(data, variables);
    }
    const { includeVFs } = this;
    if (includeVFs) {
      for(let VFName in includeVFs) {
        includeVFs[VFName].updateQueryArgs(data, variables);
      }
    }
    return this;
  }

  where(key, op, value) {
    return this._addQueryArg(key, op, value, false, null);
  }

  /**
   * Same as calling where('key', null), but just adding
   * it as an alias
   * @param {string} key
   * @returns {Query}
   */
  whereNull(key) {
    return this._addQueryArg(key, '=', null, false, null);
  }

  /**
   *
   * @param {string} key
   * @returns {Query}
   */
  orWhereNull(key) {
    return this._addQueryArg(key, '=', null, false, 'or');
  }

  andWhereNull(key) {
    return this._addQueryArg(key, '=', null, false, 'and');
  }

  orWhere(key, op, value) {
    return this._addQueryArg(key, op, value, false, 'or');
  }

  /**
   *
   * @param key {string|function}
   * @param {(?string=|?function(Query): Query=)} op
   * @param {?=} [value = undefined]
   * @returns {Query}
   */
  andWhere(key, op, value) {
    return this._addQueryArg(key, op, value, false, 'and');
  }

  whereNot(key, op, value) {
    return this._addQueryArg(key, op, value, true, null);
  }

  /**
   * Same as calling whereNot(key, null), but adding as an alias.
   * @param {string} key
   * @returns {Query}
   */
  whereNotNull(key) {
    return this._addQueryArg(key, '=', null, true, null);
  }

  orWhereNotNull(key) {
    return this._addQueryArg(key, '=', null, true, 'or');
  }

  andWhereNotNull(key) {
    return this._addQueryArg(key, '=', null, true, 'and');
  }

  orWhereNot(key, op, value) {
    return this._addQueryArg(key, op, value, true, 'or');
  }

  andWhereNot(key, op, value) {
    return this._addQueryArg(key, op, value, true, 'and');
  }

  whereIn(key, values) {
    return this._addQueryArg(key, 'in', values, false, null);
  }

  orWhereIn(key, values) {
    return this._addQueryArg(key, 'in', values, false, 'or');
  }

  andWhereIn(key, values) {
    return this._addQueryArg(key, 'in', values, false, 'and');
  }

  whereNotIn(key, values) {
    return this._addQueryArg(key, 'in', values, true, null);
  }

  orWhereNotIn(key, values) {
    return this._addQueryArg(key, 'in', values, true, 'or');
  }

  andWhereNotIn(key, values) {
    return this._addQueryArg(key, 'in', values, true, 'and');
  }

  addFieldDirective(field, name, args, argsDefaults) {
    if (this.parentMethodsMap.select) {
      this.parent.addFieldDirective(field, name, args, argsDefaults);
    } else {
      let { querySelect } = this;
      if (!querySelect) {
        this.querySelect = querySelect = {};
      }
      let { [field]: builder } = querySelect;
      if (!builder) {
        this.select(field);
        ({ [field]: builder } = querySelect);
        if (!builder) {
          // the field was not added because it does not exist.
          return this;
        }
      }
      addDirective.call(builder, name, args, argsDefaults);
    }
    return this;
  }

  addDirective(name, args, argsDefaults) {
    if (this.parentMethodsMap.addDirective) {
      this.parent.addDirective(name, args, argsDefaults);
    } else {
      addDirective.call(this, name, args, argsDefaults);
    }
    return this;
  }

  useAlias(alias) {
    if (this.parentMethodsMap.useAlias) {
      this.parent.useAlias(alias);
    } else {
      this.queryAlias = alias;
    }
    return this;
  }

  aliasField(fieldName, alias) {
    if (this.parentMethodsMap.select) {
      this.parent.aliasField(fieldName, alias);
    } else {
      const { querySelect } = this;
      if (!querySelect) {
        this.select({ [fieldName]: alias });
      } else {
        const { [fieldName]: meta } = querySelect;
        if (meta) {
          meta.alias = alias;
        } else {
          this.select({ [fieldName]: alias });
        }
      }
    }
    return this;
  }

  checkRecord(record, variables) {
    return this.queryArgs ? this.queryArgs.checkRecord(record, variables)
      : true;
  }

  createRecordResult(record, variables, RecordResult) {
    if (this.checkRecord(record, variables)) {
      if (!RecordResult) {
        ({ RecordResult } = this);
      }
      return RecordResult.build(this, variables, record);
    } else {
      return null;
    }
  }

  getFilterFn(RecordResult) {
    throw new Error('getFilterFn() has been deprecated and removed. Use checkRecord() instead.');
    // if (!this.filterFn) {
    //   if (this.queryArgs) {
    //     this.filterFn = this.queryArgs.createFilterFn(
    //       RecordResult || this.RecordResult
    //     );
    //   } else {
    //     if (!RecordResult) {
    //       RecordResult = this.RecordResult;
    //     }
    //     this.filterFn = (record, variables, includeSelect, keyBy, resp, forMutation) => {
    //       if (variables === true) {
    //         return createResult(record, undefined, this, RecordResult, keyBy, resp, forMutation);
    //       } else if (includeSelect === true) {
    //         return createResult(record, variables, this, RecordResult, keyBy, resp, forMutation);
    //       } else {
    //         return true;
    //       }
    //     }
    //   }
    // }
    // return this.filterFn;
  }

  getState(payload) {
    return payload && payload.model ? payload.model : this.model;
  }

  /**
   *
   * @param {!Object=} payload
   * @param {!string=} responseFormat
   * @param {!string=} responseFormatType
   * @param {!boolean=} forMutation
   * @returns {Object|Array|null}
   */
  get(payload, responseFormat, responseFormatType, forMutation) {
    let query, originalQuery, variables,
      records, RecordResult;
    if (payload) {
      ({ query, originalQuery, variables, records } = payload);
      if (!responseFormat) {
        ({ responseFormat, responseFormatType } = payload);
      }
    }
    if (!responseFormat) {
      responseFormat = RECORDS;
      responseFormatType = OBJECT;
    } else if (responseFormat === RECORDS_RESULTS) {
      ({ RecordResult } = query);
    }
    let queryArgs, record,
      recordResult, recordsResults = null;
    const isSingle = responseFormatType === SINGLE;
    if (records) {
      if (query && originalQuery && originalQuery.isDifferentThan(query, true)) {
        ({ queryArgs } = originalQuery);
        for(let key in records) {
          ({ [key]: record } = records);
          if (!queryArgs || queryArgs.checkRecord(record, variables)) {
            if (RecordResult) {
              recordResult = RecordResult.build(
                originalQuery, variables, record, forMutation, payload
              );
            } else {
              recordResult = record;
            }
            if (recordsResults) {
              recordsResults[key] = recordResult;
            } else {
              recordsResults = { [key]: recordResult };
            }
          }
        }
      } else if (RecordResult) {
        query = originalQuery || query || this;
        const recordsResults = {};
        for(let key in records) {
          recordsResults[key] = RecordResult.build(query, variables, records[key]);
        }
      }
    } else {
      query = originalQuery || query || this;
      ({ queryArgs } = query);
      records = this.getState(payload);
      for(let key in records) {
        ({ [key]: record } = records);
        if (!queryArgs || queryArgs.checkRecord(record, variables)) {
          recordResult = !RecordResult ? record
            : RecordResult.build(query, variables, record, forMutation, payload);
          if (recordsResults) {
            recordsResults[key] = recordResult;
          } else {
            recordsResults = { [key]: recordResult };
          }
          if (isSingle) {
            break;
          }
        }
      }
    }
    if (payload) {
      if (responseFormat === RECORDS_RESULTS) {
        payload.recordsResults = recordsResults;
      } else {
        payload.records = recordsResults;
      }
      return formatResponse(payload);
    } else {
      return recordsResults;
    }
  }

  getAll(payload) {
    return this.get(payload, RECORDS_RESULTS, OBJECT, false);
  }

  getAllForMutation(payload) {
    return this.get(payload, RECORDS_RESULTS, OBJECT, true);
  }

  getAllArray(payload) {
    return this.get(payload, RECORDS_RESULTS, ARRAY, false);
  }

  getAllRecords(payload) {
    return this.get(payload, RECORDS, OBJECT, false);
  }

  getAllRecordsArray(payload) {
    return this.get(payload, RECORDS, ARRAY, false);
  }

  getOne(payload) {
    return this.get(payload, RECORDS_RESULTS, SINGLE, false);
  }

  getOneRecord(payload) {
    return this.get(payload, RECORDS, SINGLE, false);
  }
}
Object.defineProperty(Query, CLASS_PROP, { value: QUERY });
Object.defineProperty(Query.prototype, CLASS_PROP, { value: QUERY });
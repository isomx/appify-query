import {
  CLASS_PROP,
  QUERY,
  QUERY_ARGS,
  QUERY_SELECT_FIELD,
  INCLUDE_VF,
  ARG_GROUPED_QUERY,
  ARG_VF_QUERY,
  ARG_KEY_VALUE
} from "../constants/objectTypes";

/**
 * Given a value and an OBJECT_TYPE, determines if
 * the value is either the query OBJECT_TYPE or an instance of it.
 * @function checkType
 * @param {?=} instance - Any value to check
 * @param {string} TYPE - A valid query OBJECT_TYPE
 * @returns {boolean} true if it is, false if not
 */
const checkType = (instance, TYPE) => TYPE ?
  !!(instance && instance[CLASS_PROP] === TYPE)
  : !!(instance && instance[CLASS_PROP]);

export const isQuery = data => checkType(data, QUERY);

export const isQueryArgs = data => checkType(data, QUERY_ARGS);

export const isSelectField = data => checkType(data, QUERY_SELECT_FIELD);

export const isIncludeVFArg = data => checkType(data, INCLUDE_VF);

export const isGroupedQueryArg = data => checkType(data, ARG_GROUPED_QUERY);

export const isVFQueryArg = data => checkType(data, ARG_VF_QUERY);

export const isKeyValueArg = data => checkType(data, ARG_KEY_VALUE);

export default checkType;
import {
  MAIN_QUERY,
  GROUPED_QUERY,
  VF_QUERY,
  INCLUDE_VF_QUERY
} from "../constants/instanceTypes";

const mainQueryParentProps = {
  model: false,
  queryName: false,
  queryHasVF: false,
  registerSibling: false
};

const mainQueryParentMethods = {
  select: false,
  include: false,
  addQueryArg: false,
  addDirective: false,
  useAlias: false,
};

const groupedQueryParentProps = {
  model: true,
  queryName: true,
  queryHasVF: true
};

const groupedQueryParentMethods = {
  select: true,
  include: true,
  addQueryArg: false,
  addDirective: true,
  useAlias: true,
  registerSibling: true
};

const VFQueryParentProps = {
  ...mainQueryParentProps,
  queryHasVF: true
};

const VFQueryParentMethods = {
  ...mainQueryParentMethods,
  registerSibling: true
};

const includeVFQueryParentProps = {
  ...mainQueryParentProps
};

const includeVFQueryParentMethods = {
  ...mainQueryParentMethods
};


export const parentPropsConfig = {
  [MAIN_QUERY]: mainQueryParentProps,
  [GROUPED_QUERY]: groupedQueryParentProps,
  [VF_QUERY]: VFQueryParentProps,
  [INCLUDE_VF_QUERY]: includeVFQueryParentProps
};

export const parentMethodsConfig = {
  [MAIN_QUERY]: mainQueryParentMethods,
  [GROUPED_QUERY]: groupedQueryParentMethods,
  [VF_QUERY]: VFQueryParentMethods,
  [INCLUDE_VF_QUERY]: includeVFQueryParentMethods
};
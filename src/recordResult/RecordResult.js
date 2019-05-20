import shouldInclude from '../directives/shouldInclude';

export default class RecordResult {

  __addSelect(query, variables, record) {
    const { querySelect } = query;
    if (querySelect) {
      let meta;
      for(let fieldName in querySelect) {
        ({ [fieldName]: meta } = querySelect);
        if (shouldInclude(meta, variables)) {
          this[fieldName] = record[fieldName];
        }
      }
    } else {
      const { __record } = this;
      for(let k in __record) {
        this[k] = __record[k];
      }
    }
  }

  __addIncludeVFs(includeVFs, variables, record) {
    if (includeVFs) {
      for(let VFName in includeVFs) {
        this.__addIncludeVF(includeVFs[VFName], variables, record);
      }
    }
  }

  __addIncludeVF(includeVF, variables, record) {
    const { query, VFName } = includeVF;
    if (!shouldInclude(query, variables)) {
      return;
    }
    let refs;
    refs = record[VFName];
    let { [VFName]: resp } = this;
    if (refs) {
      let r;
      for(let k in refs) {
        r = query.createRecordResult(refs[k], variables);
        if (r) {
          if (!resp) {
            resp = {};
          }
          resp[k] = r;
        }
      }
    }
    this[VFName] = resp || null;
  }

  static build(query, variables, record) {
    if (typeof record === 'undefined') {
      record = variables;
      variables = undefined;
    }
    const instance = new this(record);
    instance.__addSelect(query, variables, record);
    instance.__addIncludeVFs(query.includeVFs, variables, record);
    return instance;
  }
}
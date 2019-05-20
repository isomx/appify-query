import mergeDirectives from '../directives/mergeDirectives';
import addDirective from '../directives/addDirective';
import cloneDirectives from '../directives/cloneDirectives';
import areDirectivesDifferent from '../directives/areDirectivesDifferent';
import { getValueParam } from "../utils/params";
import { CLASS_PROP, QUERY_SELECT_FIELD } from "../constants/objectTypes";

/**
 * @class SelectField
 */
export default class SelectField {

  constructor(query) {
    this.query = query;
    this.alias = undefined;
    this.directives = undefined;
    this.directiveVariables = undefined;
    this.directiveDefaults = undefined;
  }

  static init(query) {
    return new this(query);
  }

  isDifferentThan(otherSelectField) {
    return this.name !== otherSelectField.name
      || this.alias !== otherSelectField.alias
      || areDirectivesDifferent(this, otherSelectField)
  }

  cloneField() {
    console.log(' ');
    console.warn('SelectField.cloneField() is deprecated. Use SelectField.clone() instead.');
    return this.clone();
  }

  clone(newQuery) {
    const instance = new this.constructor(newQuery);
    instance.name = this.name;
    instance.alias = this.alias;
    cloneDirectives.call(instance, this);
    return instance;
  }

  merge(source) {
    if (this.directives) {
      if (source.directives) {
        mergeDirectives(this, source);
      }
    }
    if (source.alias) {
      this.alias = source.alias;
    }
    return this;
  }

  /**
   * Used by parseDirective
   * @param val
   * @returns {*}
   */
  getValueParam(val) {
    const resp = getValueParam(val);
    if (resp) {
      this.query.queryHasVariables = true;
    }
    return resp;
  }

  field(name, alias) {
    this.name = name;
    this.alias = alias;
    return this;
  }

  /**
   * Just an alias for field
   * @param name
   * @param alias
   */
  key(name, alias) {
    this.name = name;
    this.alias = alias;
    return this;
  }

  addDirective(name, args, argsDefaults) {
    addDirective.call(this, name, args, argsDefaults);
    return this;
  }

  useAlias(alias) {
    this.alias = alias;
    return this;
  }

  /**
   * Used to determine the actual name of the field without any
   * aliases. While that can be accessed using name, this is
   * used externally (i.e., mySQL connector) to make it clear
   * what is expected
   * @returns {*}
   */
  get realName() {
    return this.name;
  }
}

Object.defineProperty(
  SelectField,
  CLASS_PROP,
  {
    value: QUERY_SELECT_FIELD,
    enumerable: false,
    writable: false
  }
);
Object.defineProperty(
  SelectField.prototype,
  CLASS_PROP,
  {
    value: QUERY_SELECT_FIELD,
    enumerable: false,
    writable: false
  }
);
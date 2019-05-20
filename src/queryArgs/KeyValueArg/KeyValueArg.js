/* eslint-disable */
import { getOperatorFn } from "@bit/appify.core.utils.matching";
import { isKeyValueArg } from "../../utils/objectTypes";
import { getValueParam } from "../../utils/params";
import { CLASS_PROP, ARG_KEY_VALUE } from "../../constants/objectTypes";

/**
 * @class KeyValueArg
 */
export default class KeyValueArg {

  constructor(queryArgs, not, join, key, op, value, valueParam) {
    this.not = not;
    this.join = join || false;
    this.argIdx = queryArgs.push(this) - 1;
    this.queryArgs = queryArgs;
    this.key = key;
    /**
     * @member {string} op
     */
    this.op = op;
    this.value = value;
    /**
     * value could be a variable, which would be
     * in the format :varName. In that case
     * we will create a valueParam property which
     * will be the extracted key name that will be
     * provided on the variables object when the
     * query executes. But we don't have to check
     * because regardless we will set the value
     * as value. And if it is not a variable then
     * getValueParam() will return undefined. This
     * is done by static create method.
     */
    this.valueParam = valueParam || false;
    this.fn = getOperatorFn(op, not);
    if (join === 'or') {
      queryArgs.argsGroupIdx++;
    }
    this.argsGroupIdx = queryArgs.argsGroupIdx;
    if (queryArgs.allArgsSelected) {
      const { query } = queryArgs;
      if (!query.isFieldSelected(key)) {
        query.select(key);
      }
    }
    this._init();
  }

  isDifferentThan(otherArg) {
    return !isKeyValueArg(otherArg)
    || this.not !== otherArg.not
    || this.join !== otherArg.join
    || this.key !== otherArg.key
    || this.op !== otherArg.op
    || this.value !== otherArg.value
    || this.valueParam !== otherArg.valueParam;
  }

  get ownQuery() {
    return this.queryArgs.query;
  }

  _init() {}

  static create(queryArgs, not, join, key, op, value) {
    return new this(
      queryArgs, not, join, key, op, value, this.getValueParam(value)
    );
  }

  clone(newArgs, newJoin) {
    if (typeof newJoin === 'undefined') {
      newJoin = this.join;
    }
    new this.constructor(
      newArgs, this.not, newJoin, this.key,
      this.op, this.value, this.valueParam
    );
  }

  checkRecord(record, variables) {
    return this.fn(
      this.valueParam ? variables[this.valueParam] : this.value,
      record[this.key]
    );
  }

  selectAllQueryArgs(targetQuery) {
    if (!targetQuery.isFieldSelected(this.key)) {
      targetQuery.select(this.key);
    }
  }

  /**
   * If our key is in the data object, we update the
   * value (or variable) with the new data provided
   * by the data object.
   * @param data
   * @param variables
   * @returns {KeyValueArg}
   */
  updateArg(data, variables) {
    const { [this.key]: keyData } = data;
    if (keyData) {
      const { valueParam } = this;
      if (valueParam) {
        variables[valueParam] = keyData;
      } else {
        this.value = keyData;
      }
    }
    return this;
  }


}
KeyValueArg.getValueParam = getValueParam;

Object.defineProperty(
  KeyValueArg,
  CLASS_PROP,
  {
    value: ARG_KEY_VALUE,
    enumerable: false,
    writable: false
  }
);

Object.defineProperty(
  KeyValueArg.prototype,
  CLASS_PROP,
  {
    value: ARG_KEY_VALUE,
    enumerable: false,
    writable: false
  }
);
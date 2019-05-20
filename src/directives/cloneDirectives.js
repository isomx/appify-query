import cloneDeep from '@bit/lodash.lodash.clone-deep';

/**
 * Clones the directives on to a new or existing instance
 * provided by the "thisArg".
 * @function cloneDirectives
 * @this {Query|SelectField}
 * @param {Query|SelectField} source - either a Query or SelectField
 * instance whose directives should be cloned on to the "this"
 * instance
 * @returns {Query|SelectField} returns the "thisArg" which can
 * be either a Query or SelectField instance.
 */
function cloneDirectives(source) {
  const { directives } = source;
  if (directives) {
    this.directives = cloneDeep(directives);
    this.directiveVariables = cloneDeep(source.directiveVariables);
    this.directiveDefaults = cloneDeep(source.directiveDefaults);
  }
  return this;
}

export default cloneDirectives;
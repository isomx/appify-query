/**
 * Analyzes the directives defined on a Query or SelectField
 * instance to determine if it should be included in the result
 * of the query.
 *
 * @function shouldInclude
 * @param {Query|SelectField} meta - The Query or SelectField
 * instance that should be analyzed to determine if it should
 * be included
 * @param {?Object=} variables - If a directive was defined
 * using a variable, a variables object with the corresponding
 * value for the variable must be provided.
 * @returns {boolean} true if the Query or SelectField should
 * be included, false if not
 */
function shouldInclude(meta, variables) {
  const { directives, directiveVariables, directiveDefaults } = meta;
  let result = true;
  if (directives) {
    const {skip, include} = directives;
    if (skip) {
      // skip has higher precedence than include
      if (directiveVariables && directiveVariables.skip) {
        const varName = directiveVariables.skip['if'];
        if (variables && variables.hasOwnProperty(varName)) {
          result = variables[varName];
        } else {
          result = directiveDefaults.skip['if'];
        }
      } else {
        result = skip['if'];
      }
      return !result;
    }
    if (include) {
      if (directiveVariables && directiveVariables.include) {
        const varName = directiveVariables.include['if'];
        if (variables && variables.hasOwnProperty(varName)) {
          result = variables[varName];
        } else {
          result = directiveDefaults.include['if'];
        }
      } else {
        result = include['if'];
      }
      return result;
    }
  }
  return result;
}

export default shouldInclude;
import cloneDeep from '@bit/lodash.lodash.clone-deep';
import mergeDeep from '@bit/lodash.lodash.merge';

/**
 * Adds a directive to a Query or a SelectField instance
 * @function addDirective
 * @this {Query|SelectField}
 * @param {!string} name - the name of the directive
 * @param {!Object.<string, ?>} args - the key:value arguments for the directive
 * @param {?Object} argsDefaults - the default arguments if the directive is
 * used but without providing arguments
 * @returns {Query|SelectField} returns the "thisArg", which can be
 * either a Query or a SelectField instance
 */
function addDirective(name, args, argsDefaults) {
  let { directives, directiveVariables, directiveDefaults } = this;
  let directive;
  if (directives) {
    ({ [name]: directive } = directives);
  }
  // Determine if any of the args contain a variable value.
  // If so, populate directiveVariables so it can be converted
  // during execution of the query based on the variables
  // provided for that run.
  let arg, argParam, directiveVars, parsedArgs, defaults, defaultValue;
  for(let key in args) {
    arg = args[key];
    if (typeof arg === 'string') {
      argParam = this.getValueParam(arg);
      if (argParam) {
        if (!directiveVars) {
          if (!directiveVariables) {
            directiveVars = { [key]: argParam };
            this.directiveVariables = directiveVariables = {
              [name]: directiveVars
            };
          } else {
            ({ [name]: directiveVars } = directiveVariables);
            if (!directiveVars) {
              directiveVars = {};
              directiveVariables[name] = directiveVars;
            }
          }
        }
        if (!parsedArgs) {
          // don't mutate the passed-in args, clone it.
          parsedArgs = cloneDeep(args);
        }
        // overwrite the arg key's value to remove the ":"
        // so it can directly access the variable at runtime.
        parsedArgs[key] = argParam;
        directiveVars[key] = argParam;
        if (directive && directive[key]) {
          // overwrite the directive's arg if the key exists,
          // since it would anyway during mergeDeep and since
          // we have a variable, the actual value could be
          // an object/array/etc which would fail mergeDeep.
          directive[key] = arg;
        }
        if (argsDefaults) {
          ({ [key]: defaultValue } = argsDefaults);
        } else {
          defaultValue = undefined;
        }
        if (typeof defaultValue === 'undefined') {
          // it was not provided.
          if (key === 'if') {
            if (name === 'skip') {
              defaultValue = false;
            } else if (name === 'include') {
              defaultValue = true;
            } else {
              throw new Error('Non-default directives must have a default value, ' +
                'provided using an extra argument to addDirective. ' +
                'Got: ' + defaultValue);
            }
          } else {
            throw new Error('Non-default directives must have a default value, ' +
              'provided using an additional argument to addDirective. ' +
              'Got: ' + defaultValue);
          }
        }
        // we know we have a default value, or an error would have been thrown.
        if (!defaults) {
          if (!directiveDefaults) {
            defaults = { [key]: defaultValue };
            this.directiveDefaults = { [name]: defaults };
          } else {
            ({ [name]: defaults } = directiveDefaults);
            if (defaults) {
              defaults[key] = defaultValue;
            } else {
              directiveDefaults[name] = defaults = { [key]: defaultValue };
            }
          }
        }
      }
    }
  }
  if (!parsedArgs) {
    // no variables were found, use the passed args as-is.
    parsedArgs = args;
  }
  if (!directives) {
    this.directives = { [name]: parsedArgs };
  } else if (!directive) {
    directives[name] = parsedArgs;
  } else {
    directives[name] = mergeDeep(directive, parsedArgs);
  }
  return this;
}

export default addDirective;
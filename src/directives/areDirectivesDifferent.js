import isEqual from '@bit/lodash.lodash.is-equal';

/**
 * Compares two directive-enabled objects and determines if their
 * directives are different from each other.
 * @function areDirectivesDifferent
 * @param {Query|SelectField} arg1
 * @param {Query|SelectField} arg2
 * @returns {boolean} true if they are different, false if they are not
 */
function areDirectivesDifferent(arg1, arg2) {
  const { directives } = arg1,
    { directives: otherDirectives } = arg2;
  if (directives && otherDirectives) {
    let directive, otherDirective;
    for(let key in directives) {
      ({ [key]: directive } = directives);
      ({ [key]: otherDirective } = otherDirectives);
      if (directive && otherDirective) {
        if (!isEqual(directive, otherDirective)) {
          return true;
        }
      } else if (!otherDirective) {
        return true;
      }
    }
    return !isEqual(arg1.directiveVariables, arg2.directiveVariables)
      || !isEqual(arg1.directiveDefaults, arg2.directiveDefaults);
  } else if (directives || otherDirectives) {
    return true;
  }
  return false;
}

export default areDirectivesDifferent;
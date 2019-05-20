import cloneDeep from '@bit/lodash.lodash.clone-deep';

/**
 * Note that destination && source can be either a Query or
 * SelectField, since the way they handle directives is the same.
 * This is also how parseDirectives() fn can be shared
 * between the two.
 * @function mergeDirectives
 * @param {Query|SelectField} destination
 * @param {Query|SelectField} source
 * @returns {Query|SelectField} returns the destination,
 * which can be either a Query or SelectField instance
 */
function mergeDirectives(destination, source) {
  const { directives: destinationDirectives } = destination,
    { directives: sourceDirectives } = source;
  if (destinationDirectives && sourceDirectives) {
    const {
        directiveVariables: destinationVariables,
        directiveDefaults: destinationDefaults
      } = destination,
      {
        directiveVariables: sourceVariables,
        directiveDefaults: sourceDefaults
      } = source;
    console.log(' ');
    console.log('---- DIRECTIVES -----')
    console.log(' DESTINATION:')
    console.log('   directives: ', destinationDirectives);
    console.log('   variables', destinationVariables);
    console.log('   defaults: ', destinationDefaults);
    console.log(' ');
    console.log(' SOURCE:')
    console.log('   directives: ', sourceDirectives);
    console.log('   variables', sourceVariables);
    console.log('   defaults: ', sourceDefaults);
    console.log(' ');
    console.log('-----------------------');
    debugger;
  } else if (sourceDirectives) {
    destination.directives = cloneDeep(sourceDirectives);
    destination.directiveVariables = cloneDeep(source.directiveVariables);
    destination.directiveDefaults = cloneDeep(source.directiveDefaults);
  }
  return destination;
}

export default mergeDirectives;
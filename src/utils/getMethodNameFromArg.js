import camelCaseFields from '@bit/appify.core.utils.camel-case-fields';

/**
 * Given a query argument, it returns the method name on Query
 * that was used to create the argument.
 *
 * Also supports returning the correct knexJs mySQL builder method
 * that corresponds to the argument. There are subtle differences
 * between the Query argument implementation and knexJs's, so this
 * can be used to easily convert a Query argument into its
 * corresponding knexJs builder argument. This means it should also
 * work for bookshelf and other similar mySQL builders, since they
 * share much of the same code. But it is only tested with knexJs, check
 * the knexJs documentation below
 *
 * **KnexJs documentation**
 *  - For mySQL, null is treated as a special value. So
 *  we don't do key = null, that wouldn't return anything.
 *  We have to use the special Knex operators whereNull/whereNotNull.
 *  These methods are also supported on our Query api, but there is
 *  no guarantee that a user will use them vs. where('key', null).
 *  So if the value of a key:value Query argument is null, this will return
 *  the proper whereNull/whereNotNull (and the and/or variants) method name
 *
 *  - There is no 'andWhereIn' method available in Knex builder, but to
 *  maintain consistency in our Query class it contains an andWhereIn. Which
 *  means it sets join === 'and'. Knex just automatically treats subsequent
 *  whereIn calls as "andWhereIn". So if andWhereIn() was used to create the
 *  argument, whereIn() will be returned instead. There is an orWhereIn on the
 *  knexJs builder, though, so this only applies to an andWhereIn().
 *
 * @function getMethodNameFromArg
 * @param {KeyValueArg} arg - the key:value Query argument
 * @param {?boolean=} [forKnex = false] - provide true to get the proper method
 * for the argument on knexJs builder.
 * @returns {string} - the method name
 */
function getMethodNameFromArg(arg, forKnex) {
  let { op, not, join } = arg, builderMethod;
  if (forKnex) {
    if (arg.value === null) {
      // convert to proper whereNull/whereNotNull base method name
      builderMethod = not ? 'whereNotNull' : 'whereNull';
      if (join && join !== 'and') {
        builderMethod = camelCaseFields(join, builderMethod);
      }
      return builderMethod;
    }
    if (op === 'in' && join === 'and') {
      // no andWhereIn knexJs method
      join = undefined;
    }
  }
  builderMethod = join ? camelCaseFields(join, 'where') : 'where';
  if (not) {
    builderMethod = camelCaseFields(builderMethod, 'not');
  }
  if (op === 'in') {
    builderMethod = camelCaseFields(builderMethod, 'in');
  }
  return builderMethod;
}

export default getMethodNameFromArg;
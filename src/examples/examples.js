import { Query } from "../query/Query";

function convolutedExample() {
  /**
   * This returns "Model" only in both sql && locally
   */
  const newQuery = Query.init(connector.Model)
    .select('id')
    .where(builder => builder
      .where('name', 'Field')
      .andWhere('engine', false)
      .andWhere('pluginId', 0)
      .orWhere('name', 'Model')
      .andWhere('pluginId', 0)
      .orWhere(builder => builder
        .where('name', 'ForeignField')
      )
    )
    .andWhere(builder => builder
      .where('name', 'Model')
      .andWhere('pluginId', 0)
    );
}

export const userWithAddress = () => {
  const testObj = {
    user: {
      1: {
        firstName: 'Josh',
        lastName: 'Cope',
        addresses: {
          primary: {
            street: '244',
            city: 'Cape Canaveral',
            state: 'FL'
          },
          previous: {
            street: '6035',
            city: 'Colorado Springs',
            state: 'CO'
          }
        }
      },
      2: {
        firstName: 'Mark',
        lastName: 'Wilson',
        addresses: {
          primary: {
            street: '246',
            city: 'Cocoa Beach',
            state: 'FL'
          },
          previous: {
            street: '6035',
            city: 'Colorado Springs',
            state: 'CO'
          }
        }
      }
    }
  };
  const params = {
    skipIf: true, includeIf: false,
    state1: 'CO', state2: 'NY'
  };
  let query = new Query(testObj.user)
    .where('firstName', 'Mark')
    .orWhere('firstName', 'Josh')
    .andWhere('addresses', q => q
      .where('state', ':state1')
      .orWhere('state', ':state2')
    )
    .select('firstName')
    .include('addresses', q => q
        .where('street', '246')
        .andWhere(q => q
          .where('state', 'CO')
          .orWhere('state', 'FL')
        )
        .addDirective('skip', { if: ':skipIf' })
        .select('street',
          f => f
            .key('state')
            .addDirective('include', { if: ':includeIf' })
        )
        .deSelect('street')
      // .addFieldDirective('state', 'include', { if: ':includeIf' })
    );
  const filterFn = query.getFilterFn();
  const objectArray = [ testObj.user['1'], testObj.user['2'] ];
  const result = objectArray.filter(filterFn);
  console.log('result = ', result);
  return;
  const run1 = query.getAll(params, true, {});
  params.skipIf = false;
  params.includeIf = true;
  params.state1 = 'FL'
  const run2 = query.getAll(params, true, {});
  console.log('run1 = ', run1);
  console.log('run2 = ', run2);
}

export const deterministicExample = (Model) => {
  let exampleQuery = Model.query()
    .where(q => q
      .where('fields', q => q
          .where('name', 'modelId') // removing this makes it non-deterministic.
          .andWhere('foreignField', q => q
            .where('relationship', 'belongsTo')
            .orWhere('refModelRelationship', 'hasMany')
          )
        // .orWhere('name', 'id')
      )
    )
    .andWhere('name', 'Field')
    .andWhere('pluginId', 0)
}

export const directiveExample = (Model) => {

  let modelQuery = Model.query()
    .addDirective('skip', { if: false })
    .addDirective('skip', { if: false })
    .where('name', 'Field')
    .andWhere('pluginId', 0)
    .include('fields', q => q
      .whereIn('name', [ 'modelId', 'id' ])
      .orWhere('autoIncrement', true)
      .select(f => f.field('id', 'aliasName')
          .addDirective('include', { if: ':value2' }, { if: true })
        , 'modelId')
      .include('foreignField', q => q
        // .select({ fieldId: 'fieldIdAlias' })
          .select('fieldId')
          .include('field', q => q
            .include('model', q => q
              .where('name', 'ForeignField')
            )
          )
          .useAlias('extraFields')
      )
    )
    .useAlias('myAlias')
    // .includeAll()
    .select('name', 'id', 'cache', 'timestamps')
}
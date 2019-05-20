# Query

Provides a mySQL-like interface for querying Objects client-side. For example, query a redux store like a database

## Installation


   1. Add @bit as a scoped registry
       ```
       npm config set @bit:registry https://node.bit.dev
       ```
       
   2. Install like any other package
       ```bash
       npm install --save @bit/appify.query.query
       ```

## Usage

The API is nearly identical to [KnexJs](https://knexjs.org), except with the added ability to integrate Virtual Field queries (or foreignFields in terms of mySQL) in both the query as well as in the returned result set. [Checkout their documentation](https://knexjs.org)

> **Any nested object is considered a "virtual field" to its parent. See below example**

## Example

```js
const exampleObject = {
  "primaryKey_1": {
    firstName: 'Mark',
    lastName: 'Jacobs',
    age: 30,
    address: { // address is considered a virtual field because it is a nested object
      street: '1500 4th ave',
      city: 'San Francisco',
      state: 'CA',
      zip: '29341'
    }
  },
  "primaryKey_2": {
    firstName: 'David',
    lastName: 'Smith',
    age: 45,
    address: {
      street: '467 Seminole Way',
      city: 'Memphis',
      state: 'TN',
      zip: '32401'
    }
  },
  "primaryKey_3": {
    firstName: 'Amy',
    lastName: 'Reis',
    age: 38,
    address: {
      street: '726 Williams Street',
      city: 'Montgomery',
      state: 'AL',
      zip: '36701'
    }
  }
}


const query = Query.init(exampleObject)
    .whereIn('firstName', [ 'David', 'Amy' ])
    .orWhere('lastName', 'Jacobs')
    .andWhere(groupedQuery => groupedQuery
      .where('age', '<', 39)
      // supports nesting queries or VFQueries to any depth
      .orWhere('address', VFQuery => VFQuery
        .where('state', 'CA')
        .andWhereNot('city', 'Sacramento')
      )
    )
    .andWhereNot('address', VFQuery => VFQuery
      .where('city', 'TimBukTu')
      .orWhere('state', 'MA')
    )
    .select([ 'firstName', 'lastName' ])
    .include('address', includeVFQuery => includeVFQuery
      // virtual fields can be used to limit the overall
      // records, but then can also be included in the result(s)
      // based on different parameters
      .select('state')
      .where('city', 'Montgomery')
    )
    // to include virtual fields in the result set based on the
    // query arguments provided in the parent query:
    
    // .includeFromQueryArgs('address', /** 'select' fields: /** [ 'state' ])
    .getAll();

console.log(query);

/** PRINTS 
{
  "primaryKey_1": {
    firstName: 'Mark',
    lastName: 'Jacobs',
    address: {
      state: 'CA'
    }
  },
  "primaryKey_3": {
    firstName: 'Amy',
    lastName: 'Reis',
    address: null // her city is Montgomery, so not included in result set
  }
}
**/
```

## Features

### Graphql-like

#### Directives

```js
const query = Query.init(exampleObject)
   .selectAll()
   .where('firstName', 'Amy')
   .addDirective('skip', { if: true })
   .getAll();

console.log(query)
// null
```

Directives can be applied to select fields too:

```js
const query = Query.init(exampleObject)
    .select([ 'firstName', 'lastName' ])
    .where('address', VFQuery => VFQuery
      .where('state', 'CA')
    )
    .addFieldDirective('firstName', 'include', { if: false })
    .getAll()
    
console.log(query)
/** 
{
  "primaryKey_1": {
      lastName: 'Jacobs'
  }
} 
**/

```

### Supports variables

Prepend a value with `:` followed by the variable name. Works for directives too.

Then provide a variables object to any of the getXXX() methods with variableName:value pairs

```js
query.getAll({
  variables: {
    variableName: 'value',
    anotherVar: 'another value'
  }
});
``` 

### Simple query interpolation

All queries can be seen as a standalone, or can be attached to another query

```js
const query = Query.init(dataObject)
    .where('lastName', 'Williams')
    .orWhere('age', '>=', 21)
    
const query2 = Query.init(dataObject)
    .whereNot(query);
    
// you can also clone queries to move them around or for any other reason. 
const query2Clone = query2.clone(); // Any changes to query2Clone will not affect query2.

// or build a query based on another query

const anotherQuery = Query.init(dataObject)
    .buildFromQuery(query2)
    .select([ 'age' ])
    .getAllArray()
```

### Easily extendable

All portions of the query are modular, and in fact are available as separate NPM packages to easily create your own custom implementation 

> This package is just the generic version for our own Appify Store - demo coming soon

### More feature documentation coming soon...

## Links

- [queryArgs](../queryArgs)
- [directives](../directives)
- [includeVF](../includeVF)
- [select](../selectField)


## Tasks

- [ ] Documentation





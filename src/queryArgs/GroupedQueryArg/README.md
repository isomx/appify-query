# GroupedQueryArg

Manages a group of query arguments

```js
const query = Query.init(model)
    .where(query => query 
      // this is the groupedQuery, managed by GroupedQueryArg 
      // on the parent query (which in this example is the main query)
      .where('someKey', '=', 'someValue')
      .orWhere('someKey', '=', 'someOtherValue')
    )
    .andWhere('anotherKey', 'anotherValue') // not a grouped query
```

There is no limit to how deeply grouped queries can be nested

```js
const query = Query.init(model)
    .where(groupedQuery => groupedQuery 
      // this is the groupedQuery, managed by GroupedQueryArg 
      // on the parent query (which in this example is the main query)
      .where('someKey', '=', 'someValue')
      .orWhere('someKey', '=', 'someOtherValue')
      .orWhere(anotherGroupedQuery => anotherGroupedQuery
        .where(thirdGroupedQuery => thirdGroupedQuery
          .whereIn('key', [ 'value1', 'value2', 'value3' ])
          .andWhereNot('key2', 'someValue')
        )
        .orWhere(fourthGroupedQuery => fourthGroupedQuery
          .whereIn('key', [ 'value3', 'value4', 'value5' ])
          .andWhere('key2', 'someValue')
        )
        // ...more groupedQueries as necessary
      )
    )
    .andWhere('anotherKey', 'anotherValue') // not a grouped query
```

## Installation

Already included with query, or this can be added as a standalone package:

   1. Add @bit as a scoped registry
       ```
       npm config set @bit:registry https://node.bit.dev
       ```
       
   2. Install like any other package
       ```bash
       npm install --save @bit/appify.query.grouped-query-arg
       ```


## Usage

A GroupedQueryArg instance is generated automatically for each groupedQueryArg. But if additional functionality is needed, or if you wish to override any methods, you can extend this class and provide your new Class on the static GroupedQueryArg property of QueryArgs. This means if you wish to extend this Class, you must also extend the QueryArgs class and the Query class

```js
class MySpecialGroupedQueryArg extends GroupedQueryArg {
  
  mySpecialMethod() {
    // ...do stuff
  }
}

class MySpecialQueryArgs extends QueryArgs {
  static GroupedQueryArg = MySpecialGroupedQueryArg
}

class MyQuery extends Query {
  static QueryArgs = MySpecialQueryArgs
}

```

That's it! `MySpecialGroupedQueryArg` will now be instantiated for each grouped query arg on the query
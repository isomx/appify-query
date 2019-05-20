# QueryArgs

Manages the query arguments for Query

## Installation

Already included with query, or this can be added as a standalone package:

   1. Add @bit as a scoped registry
       ```
       npm config set @bit:registry https://node.bit.dev
       ```
       
   2. Install like any other package
       ```bash
       npm install --save @bit/appify.query.query-args
       ```


## Usage

#### Default

An instance of QueryArgs is created automatically when the first query argument is added through the Query API to the Query.

```js
const query = Query.init(model)
   .where('key', 'value') // triggers an instance of QueryArgs
   
// an instance of QueryArgs will not get created:
const query2 = Query.init(model)
   .select([ 'key1', 'key2', 'key3' ])
   .getAll()
   
```

#### Extend

QueryArgs can be easily extended/modified. Simply extend QueryArgs, adding any additional methods/properties, then extend Query and add the modified QueryArgs on Query's static QueryArgs property.

```js
class MySpecialQueryArgs extends QueryArgs {
  
  // ...methods/overrides
}

class MySpecialQuery extends Query {
  static QueryArgs = MySpecialQueryArgs;
}

// then use
const query = MySpecialQuery.init(model)
   .where('key', 'value')
   //...etc
```

## See

 - [KeyValueArg](./KeyValueArg)
 - [GroupedQueryArg](./GroupedQueryArg)
 - [VFQueryArg](./VFQueryArg)
 
## Tasks
 - [ ] Documentation
 - [x] Package integration
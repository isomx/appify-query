# KeyValueArg

Manages a single key value query argument.

```js
const query = Query.init(model)
   .where('key', 'value') // this is a single keyValueArg
   .orWhere('key2', '>', 5) // so is this
   .orWhereIn('key3', [ 'value1', 'value2', 'value3' ]) // and so is this
```

## Installation

Already included with query, or this can be added as a standalone package:

   1. Add @bit as a scoped registry
       ```
       npm config set @bit:registry https://node.bit.dev
       ```
       
   2. Install like any other package
       ```bash
       npm install --save @bit/appify.query.key-value-arg
       ```


## Usage

A KeyValueArg instance is generated automatically for each key value query arg. But if additional functionality is needed, or if you wish to override any methods, you can extend this class and provide your new Class on the static KeyValueArg property of QueryArgs. This means if you wish to extend this Class, you must also extend the QueryArgs and Query classes.

```js
class MySpecialKeyValueArg extends KeyValueArg {
  
  mySpecialMethod() {
    // ...do stuff
  }
}

class MySpecialQueryArgs extends QueryArgs {
  static KeyValueArg = MySpecialKeyValueArg
}

class MyQuery extends Query {
  static QueryArgs = MySpecialQueryArgs
}

```

That's it! `MySpecialKeyValueArg` will now be instantiated for each key value arg on the query
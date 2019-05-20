# VFQueryArg

Manages a virtual field query argument

```js
const query = Query.init(model)
    .where('SomeVirtualField', query => query 
      // this is the VFQuery, managed by VFQueryArg 
      // on the parent query (which in this example is the main query)
      .where('someKey', '=', 'someValue')
      .orWhere('someKey', '=', 'someOtherValue')
    )
    .andWhere('anotherKey', 'anotherValue') // not a VFQuery
```

There is no limit to how deeply virtual field queries can be nested

```js
const query = Query.init(model)
    .where('VF_someName_on_model', VFQuery => VFQuery 
      // this is the VFQuery, managed by VFQueryArg 
      // on the parent query (which in this example is the main query)
      .where('someKey', '=', 'someValue')
      .orWhere('someKey', '=', 'someOtherValue')
      .orWhere('VF_anotherName_on_someName', anotherVFQuery => anotherVFQuery
        .where('VF_thirdName_on_anotherName', thirdVFQuery => thirdVFQuery
          .whereIn('key', [ 'value1', 'value2', 'value3' ])
          .andWhereNot('key2', 'someValue')
        )
        .orWhere('VF_fourthName_on_anotherName', fourthVFQuery => fourthVFQuery
          .whereIn('key', [ 'value3', 'value4', 'value5' ])
          .andWhere('key2', 'someValue')
        )
        // ...more VFQueries as necessary
      )
    )
    .andWhere('anotherKey', 'anotherValue') // not a VF query
```

## Installation

Already included with query, or this can be added as a standalone package:

   1. Add @bit as a scoped registry
       ```
       npm config set @bit:registry https://node.bit.dev
       ```
       
   2. Install like any other package
       ```bash
       npm install --save @bit/appify.query.vf-query-arg
       ```


## Usage

A VFQueryArg instance is generated automatically for each VFQueryArg. But if additional functionality is needed, or if you wish to override any methods, you can extend this class and provide your new Class on the static VFQueryArg property of QueryArgs. This means if you wish to extend this Class, you must also extend the QueryArgs class and the Query class

```js
class MySpecialVFQueryArg extends VFQueryArg {
  
  mySpecialMethod() {
    // ...do stuff
  }
}

class MySpecialQueryArgs extends QueryArgs {
  static VFQueryArg = MySpecialVFQueryArg
}

class MyQuery extends Query {
  static QueryArgs = MySpecialQueryArgs
}

```

That's it! `MySpecialVFQueryArg` will now be instantiated for each VF query arg on the query
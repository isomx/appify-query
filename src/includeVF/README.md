# IncludeVF
Handles a single virtual field include for a Query.

## Installation

Already included with query, or this can be added as a standalone package:

   1. Add @bit as a scoped registry
       ```
       npm config set @bit:registry https://node.bit.dev
       ```
       
   2. Install like any other package
       ```bash
       npm install --save @bit/appify.query.include-vf
       ```

## Usage
This should be considered a base implementation, and while much of the necessary functionality is in place, it is not stable to use on its own (although very basic usage is ok).

Full implementation would require making assumptions about how a data model defines/stores virtual fields and their corresponding data, and Query is meant to be a generic utility.

But this has been built to be easily extendable.
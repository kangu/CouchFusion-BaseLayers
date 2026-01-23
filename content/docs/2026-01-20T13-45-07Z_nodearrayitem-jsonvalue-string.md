# Initial Prompt
Expected String with value "[object Object]", got Object  
  at <NodeObjectField key=4 schema= {key: 'bitcoinAdjacent', label: 'Bitcoin Adjacent', type: 'jsonobject', default: {…}, fields: Array(6)}

# Implementation Summary
Ensured NodeArrayItem passes a formatted JSON string to NodeObjectField for array item jsonobject fields.

# Documentation Overview
- Normalized NodeObjectField jsonValue to use formatJsonValue for array item object fields.

# Implementation Examples
- `:json-value="formatJsonValue(getArrayItemObjectValue(...))"`

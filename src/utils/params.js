
// format = :paramName:
export const getValueParam = val => typeof val === 'string' && val.indexOf(':') === 0
  ? val.replace(':', '') : undefined;

// format = :paramVal
export const getKeyParam = key => key.indexOf(':') === 0 ? key.split(':')[1]
  : undefined;
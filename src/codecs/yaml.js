// Generic YAML data codec (strict-reject subset — see ../yaml.js).
// kind: data — outlined for reading, value-diffed downstream.
import { parseYaml } from '../yaml.js';

export const id = 'yaml';
export const kind = 'data';
export const acceptsText = true;

export function parseValue(input) {
  return typeof input === 'string' ? parseYaml(input) : input;
}

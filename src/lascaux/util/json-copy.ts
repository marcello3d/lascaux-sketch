export default function jsonCopy<T>(object: T): T {
  return JSON.parse(JSON.stringify(object));
}

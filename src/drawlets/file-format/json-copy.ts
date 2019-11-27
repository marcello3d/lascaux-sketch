export default function jsonCopy(object: any) {
  return JSON.parse(JSON.stringify(object));
}

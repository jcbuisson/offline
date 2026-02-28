
export function sortedJson(obj) {
   return JSON.stringify(obj, Object.keys(obj).sort())
}
console.log('sortedJson({ age: 30, name: "Alice", city: "Paris" })', sortedJson({ age: 30, name: "Alice", city: "Paris" }))

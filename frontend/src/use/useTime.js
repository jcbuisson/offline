
let diff

export async function getTime() {
   return new Date()
   const res = await fetch("http://worldtimeapi.org/api/ip")
   const data = res.json()
   return data.datetime
}

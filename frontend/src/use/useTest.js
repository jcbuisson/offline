import { ref, onMounted, onUnmounted } from "vue"


export function useTest() {

   onMounted(() => {
      console.log('onMounted test')
   })
   
   onUnmounted(() => {
      console.log('onUnmounted test')
   })
   
   function a() {
      return 123
   }
   
   return { a }
}

export function validateUserMutation({ args }, action) {
   const data = args[1]
   if (action === 'update' && !Object.hasOwn(data ?? {}, 'email')) return
   if (typeof data?.email !== 'string' || !/^([a-z0-9_.-]+)@([\da-z.-]+)\.([a-z.]{2,6})$/.test(data.email)) {
      const error = new Error("L'email doit être valide et non vide.")
      error.code = 'invalid-argument'
      throw error
   }
}

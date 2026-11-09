// Credentials and URL query/fragment options do not identify a CouchDB database.
// Hash the endpoint so storage names contain neither credentials nor URL syntax.
export async function storageForRemote(remote, origin) {
   const url = new URL(remote, origin)
   const identity = new URL(url)
   identity.username = ''
   identity.password = ''
   identity.search = ''
   identity.hash = ''
   identity.pathname = identity.pathname.replace(/\/+$/, '') || '/'
   const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(identity.href))
   const namespace = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
   return {
      remote: url.href,
      relational: `idb://offline-pgcouch-relational-${namespace}`,
      transactions: `offline-pgcouch-transactions-${namespace}`,
      lock: `offline-pgcouch-owner-${namespace}`,
      worker: `offline-pgcouch-${namespace}`,
   }
}

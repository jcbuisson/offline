import { PGlite } from '@electric-sql/pglite'
import { worker } from '@electric-sql/pglite/worker'

worker({
   init: options => new PGlite({ dataDir: options.dataDir }),
})

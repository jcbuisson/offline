import 'dotenv/config'
import { pathToFileURL } from 'node:url'
import { io } from 'socket.io-client'

export const help = `Usage: npm run client -- [--url URL] [--path PATH] [--timeout MS] ACTION MODEL [ARGS]

Models: group, user (groups and users also accepted)
Actions:
  find MODEL [UID | JSON_FILTER]     Find all rows, one UID, or matching rows
  create MODEL JSON_DATA            Create a row (uid is optional)
  update MODEL UID JSON_DATA        Update fields on a row
  delete MODEL UID                  Delete a row (memberships cascade)

Examples:
  npm run client -- find groups
  npm run client -- find users '{"email":"alice@example.com"}'
  npm run client -- create group '{"name":"Team"}'
  npm run client -- create user '{"email":"alice@example.com","firstname":"Alice"}'
  npm run client -- update group GROUP_UID '{"name":"Renamed"}'
  npm run client -- delete group GROUP_UID

Defaults: BACKEND_URL or http://localhost:PORT (PORT defaults to 3000),
          BACKEND_WS_PATH or /offline-socket-io/, timeout 20000 ms.
Use --url https://YOUR_HOST to target production.
Writes use backend services and are replicated to browsers through PGCouch.`

function jsonObject(value) {
   let parsed
   try { parsed = JSON.parse(value) } catch { throw new Error('Expected a valid JSON object') }
   if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('Expected a JSON object')
   return parsed
}

export function parseCommand(argv) {
   const options = {
      url: process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 3000}`,
      path: process.env.BACKEND_WS_PATH || '/offline-socket-io/', timeout: 20000,
   }
   const positional = []
   for (let i = 0; i < argv.length; i++) {
      const arg = argv[i]
      if (arg === '--help' || arg === '-h') return { help: true }
      if (['--url', '--path', '--timeout'].includes(arg)) {
         const value = argv[++i]
         if (!value || value.startsWith('--')) throw new Error(`Missing value for ${arg}`)
         options[arg.slice(2)] = arg === '--timeout' ? Number(value) : value
      } else if (arg.startsWith('--')) throw new Error(`Unknown option: ${arg}`)
      else positional.push(arg)
   }
   if (!Number.isSafeInteger(options.timeout) || options.timeout < 1) throw new Error('Timeout must be a positive integer in milliseconds')
   const url = new URL(options.url)
   if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Backend URL must use http or https')
   const [action, inputModel, ...args] = positional
   const model = { group: 'group', groups: 'group', user: 'user', users: 'user' }[inputModel]
   if (!model) throw new Error('Choose a model: group or user')
   let method, parameters
   if (action === 'find' && args.length <= 1) {
      const filter = args[0]
      method = !filter || filter.trimStart().startsWith('{') ? 'findMany' : 'findUnique'
      parameters = [!filter ? {} : method === 'findMany' ? jsonObject(filter) : { uid: filter }]
   } else if (action === 'create' && args.length === 1) {
      method = 'create'; parameters = [jsonObject(args[0])]
   } else if (action === 'update' && args.length === 2 && args[0]) {
      method = 'update'; parameters = [args[0], jsonObject(args[1])]
   } else if (action === 'delete' && args.length === 1 && args[0]) {
      method = 'delete'; parameters = [args[0]]
   } else throw new Error('Invalid action or arguments. Run with --help for usage.')
   return { ...options, model, method, parameters }
}

// Use the same Socket.IO request/ack protocol as express-x's browser client,
// without importing its Vue/browser storage dependencies into Node.
export async function runCommand({ url, path, timeout, model, method, parameters }) {
   const socket = io(url, { path, autoConnect: false, reconnection: false, timeout })
   try {
      await new Promise((resolve, reject) => {
         socket.once('connect', resolve)
         socket.once('connect_error', reject)
         socket.connect()
      })
      const { error, result } = await socket.timeout(timeout).emitWithAck('client-request', {
         name: model, action: method, args: parameters,
      })
      if (error) throw error
      return result
   } finally { socket.disconnect() }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
   try {
      const command = parseCommand(process.argv.slice(2))
      if (command.help) console.log(help)
      else console.log(JSON.stringify(await runCommand(command), null, 2))
   } catch (error) {
      console.error('Client failed:', error.message || String(error))
      process.exitCode = 1
   }
}

import http from 'http'
import express, { Express } from 'express'
import session from 'express-session'
import swaggerUi from 'swagger-ui-express'
import * as swaggerDocument from './swagger.json'

import morgan from 'morgan'
import routes from './routes/chats'
import MemcachedStore from 'connect-memcached'
import { RUNTIME } from './constants'

require('dotenv').config()
const runtime = RUNTIME()

const memcached = MemcachedStore(session)
const memcachedInstance = new memcached({
  hosts: [process.env.MEMCACHED_URL ?? 'localhost:11211'],
  secret: 'thisisaverysecretkeyforencryptingsessioncookie',
})

const app = express()

app.use(
  session({
    secret: 'thisisaverysecretkeyforencryptingsessioncookie',
    name: 'app.sess',
    resave: false,
    saveUninitialized: false,
    store: memcachedInstance,
  }),
)

const router: Express = app

router.use(morgan('dev'))
router.use(express.urlencoded({ extended: false }))
router.use(express.json())

router.use((req, res, next) => {
  // set the CORS policy
  res.header('Access-Control-Allow-Origin', '*')
  // set the CORS headers
  res.header('Access-Control-Allow-Headers', 'origin, X-Requested-With,Content-Type,Accept, Authorization')
  // set the CORS method headers
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Methods', 'GET PUT POST')
    return res.status(200).json({})
  }
  next()
})

// Set up Swagger documentation
router.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument))

/** Routes */
router.use('/v1', routes)

/** Error handling */
router.use((req, res, next) => {
  const error = new Error('not found')
  return res.status(404).json({
    message: error.message,
  })
})

process.on('unhandledRejection', (reason, p) => {
  console.log('Unhandled Rejection at: Promise', p, 'reason:', reason)
  // application specific logging, throwing an error, or other logic here
})

/** Server */
const httpServer = http.createServer(router)
const PORT: any = process.env.PORT ?? 6060
httpServer.listen(PORT, () => console.log(`The server is running on port ${PORT}`))

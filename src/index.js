'use strict'

let { randomBytes } = require('crypto')
let debug = require('debug')('litecoind')
let _spawn = require('cross-spawn')
let RpcClient = require('bitcoin-core')
let flags = require('./flags.js')

const logging = process.env.LITECOIND_LOG
const binPath = process.env.LITECOIND_BINARY ||
  require.resolve('../bin/litecoind')

function spawn (opts) {
  let args = flags(opts)
  debug('spawning: litecoind ' + args.join(' '))
  let start = Date.now()
  let child = _spawn(binPath, args)

  process.once('exit', () => {
    child.kill()
  })

  setTimeout(() => {
    try {
      child.stdout.resume()
      child.stderr.resume()
    } catch (err) {}
  }, 4000)

  if (logging) {
    child.stdout.pipe(process.stdout)
    child.stderr.pipe(process.stderr)
  }

  let promise = new Promise((resolve, reject) => {
    child.once('exit', (code) => {
      if (code !== 0) {
        let err
        if (Date.now() - start < 1000) {
          let stderr = child.stderr.read().toString()
          err = Error(stderr)
        } else {
          err = Error(`litecoind exited with code ${code}`)
        }
        return reject(err)
      }
      resolve()
    })
    child.once('error', reject)
  })
  child.then = promise.then.bind(promise)
  child.catch = promise.catch.bind(promise)
  return child
}

function maybeError (res) {
  if (res.killed) return
  if (res.then != null) {
    return res.then(maybeError)
  }
  if (res.code !== 0) {
    throw Error(`litecoind exited with code ${res.code}`)
  }
}

function node (opts = {}) {
  opts = Object.assign({
    server: true,
    rpcuser: randomString(),
    rpcpassword: randomString()
  }, opts)

  if (opts.rpcport == null) {
    opts.rpcport = opts.regtest ? 19332 : 9333
  }

  let child = spawn(opts)

  let network = 'mainnet'
  if (opts.testnet) network = 'testnet'
  if (opts.regtest) network = 'regtest'

  let rpc = new RpcClient({
    username: opts.rpcuser,
    password: opts.rpcpassword,
    network,
    logger: { debug }
  })

  let started
  return Object.assign(child, {
    rpc,
    started (timeout) {
      if (started) return started
      started = waitForRpc(rpc, child, timeout)
      return started
    }
  })
}

let waitForRpc = wait(async (client) => {
  await client.getNetworkInfo()
  return true
})

function wait (condition) {
  return async function (client, child, timeout = 30 * 1000) {
    let start = Date.now()
    while (true) {
      let elapsed = Date.now() - start
      if (elapsed > timeout) {
        throw Error('Timed out while waiting')
      }

      try {
        if (await condition(client)) break
      } catch (err) {}

      await sleep(1000)
    }
  }
}

function sleep (ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomString () {
  return randomBytes(10).toString('base64')
}

module.exports = node

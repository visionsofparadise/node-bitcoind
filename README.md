# litecoind

Run a Litecoin Core full node from Node.js.

On install, this package downloads a prebuilt binary from the [official Litecoin Core releases](https://litecoin.org/), and checks it against a known SHA256 hash.

## Usage
`npm install litecoind`

```js
let litecoind = require('litecoind')

// start the full node
let node = litecoind({
  // options are turned into CLI args
  testnet: true,
  rpcport: 12345
})

// returns handle to child process
node.stdout.pipe(process.stdout)

// comes with initialized rpc client
node.rpc.getNetworkInfo().then(console.log)
```

### `litecoind(opts)`

Spawns a Litecoin Core full node.

Returns a `ChildProcess` object representing the `litecoind` process. It has an `rpc` property which is a client for the node's RPC server (from the [bitcoin-core](https://github.com/ruimarinho/bitcoin-core) package).

`opts` may be an object containing options passed to litecoind as CLI arguments (you may use any flag supported by litecoind). To see all supported options, run `npx litecoind --help`.

### CLI

Installing the package also exposes a `litecoind` command, so you can use this as an easy way to install litecoin:
```
$ npm i -g litecoind
$ litecoind -version
```

#!/usr/bin/env node

const { createHash } = require('crypto')
const {
  createWriteStream,
  readFileSync,
  renameSync,
  accessSync,
  copyFileSync
} = require('fs')
const { createGunzip } = require('zlib')
const { homedir } = require('os')
const { join, dirname } = require('path')
const { get } = require('axios')
const ProgressBar = require('progress')
const mkdirp = require('mkdirp').sync
const tar = require('tar')
const rimraf = require('rimraf').sync

let versionPath = join(__dirname, 'version')
let litecoindVersion = readFileSync(versionPath, 'utf8').trim()

let cacheBinPath = join(
  homedir(),
  '.node-litecoind',
  `litecoind_${litecoindVersion}`
)
let binPath = join(__dirname, 'litecoind')
try {
  accessSync(cacheBinPath)
  // binary was already downloaded
  copyFileSync(cacheBinPath, binPath)
  process.exit(0)
} catch (err) {
  if (err.code !== 'ENOENT') throw err
}

console.log(`downloading Litecoin Core v${litecoindVersion}`)
let binaryDownloadUrl = getBinaryDownloadURL(litecoindVersion)
get(binaryDownloadUrl, { responseType: 'stream' }).then((res) => {
  if (res.status !== 200) {
    throw Error(`Request failed, status: ${res.status}`)
  }
  let length = +res.headers['content-length']

  let template = '[:bar] :rate/Mbps :percent :etas'
  let bar = new ProgressBar(template, {
    complete: '=',
    incomplete: ' ',
    width: 20,
    total: length / 1e6 * 8
  })

  let extractPath = join(__dirname, `litecoin-${litecoindVersion}`)
  let tempBinPath = join(extractPath, 'bin/litecoind')
  let shasumPath = join(__dirname, 'SHA256SUMS.asc')

  res.data
    .pipe(createGunzip())
    .pipe(tar.extract({
      cwd: __dirname,
      filter (path, entry) {
        return path === `litecoin-${litecoindVersion}/bin/litecoind`
      }
    }))
  // TODO: windows unzip

  // verify hash of file
  // Since the SHA256SUMS file comes from npm, and the binary
  // comes from GitHub, both npm AND GitHub would need to be
  // compromised for the binary download to be compromised.
  let hasher = createHash('sha256')
  res.data.on('data', (chunk) => hasher.update(chunk))
  res.data.on('end', () => {
    console.log()

    let actualHash = hasher.digest().toString('hex')

    // TODO: verify SHA256SUMS against signing key

    // get known hash from SHA256SUMS file
    let shasums = readFileSync(shasumPath).toString()
    let expectedHash
    for (let line of shasums.split('\n').slice(3)) {
      let [ shasum, filename ] = line.split(/\s+/)
      if (shasum.length !== 64) continue
      if (binaryDownloadUrl.endsWith(filename)) {
        expectedHash = shasum
        break
      }
    }

    if (actualHash !== expectedHash) {
      console.error('ERROR: hash of downloaded Litecoin Core binaries did not match')
      process.exit(1)
    }

    console.log('✅ verified hash of Litecoin Core binaries\n')
    renameSync(tempBinPath, binPath)
    rimraf(extractPath)

    mkdirp(dirname(cacheBinPath))
    copyFileSync(binPath, cacheBinPath)
  })

  // increment progress bar
  res.data.on('data', (chunk) => bar.tick(chunk.length / 1e6 * 8))
})

// gets a URL to the .tar.gz or .zip, hosted on litecoin.org
function getBinaryDownloadURL (version) {
  function url (filename) {
    return `https://download.litecoin.org/litecoin-${version}/${filename}`
  }

  function throwUnknownArchError () {
    throw Error(`Arch "${process.arch}" not supported`)
  }

  switch (process.platform) {
    case 'darwin':
      return url(`osx/litecoin-${version}-osx64.tar.gz`)
    case 'linux':
      switch (process.arch) {
        case 'x32':
          return url(`linux/litecoin-${version}-i686-pc-linux-gnu.tar.gz`)
        case 'x64':
          return url(`linux/litecoin-${version}-x86_64-linux-gnu.tar.gz`)
        case 'arm':
          return url(`linux/litecoin-${version}-arm-linux-gnueabihf.tar.gz`)
        case 'arm64':
          return url(`linux/litecoin-${version}-aarch64-linux-gnu.tar.gz`)
        default:
          throwUnknownArchError()
      }
    // TODO: support windows
    // case 'win32':
    //   switch (process.arch) {
    //     case 'x32':
    //       return url('win32.zip')
    //     case 'x64':
    //       return url('win64.zip')
    //     default:
    //       throwUnknownArchError()
    //   }
  }

  throw Error(`Platform "${process.platform}" is not supported`)
}

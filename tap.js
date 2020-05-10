//const test = require('tape-promise/tape')
const _ = require('lodash')
const tapSpec = require('tap-spec')
const through = require('through2')

const BEFORE_EACH = '__beforeEach'
const BEFORE_ALL = '__beforeAll'
const AFTER_EACH = '__afterEach'
const AFTER_ALL = '__afterAll'

const defaultStream = () => {
  let stream = through()
  stream.pipe(tapSpec()).pipe(process.stdout)
  return stream
}

const _stream = defaultStream()

class SuiteTap {
  constructor(stream) {
    this.testCount = 0
    this.stream = stream || defaultStream()
  }

  _emit(str) {
    if (this.stream) {
      this.stream.write(str + "\n")
    }
  }

  start() {
    this._emit('TAP version 13')
  }

  test(path, testNum, err) {
    const desc = path.join(' | ')
    const resStr = !err ? 'ok' : 'not ok'
    this._emit(`${resStr} ${testNum} ${desc}`)
  }

  finish() {
    //this._emit(`1..${this.testCount}`)
    this.stream.end()
  }
}

module.exports = SuiteTap

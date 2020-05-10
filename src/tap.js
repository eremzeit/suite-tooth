//const test = require('tape-promise/tape')
const _ = require('lodash')
const tapSpec = require('tap-spec')
const through = require('through2')

const BEFORE_EACH = '__beforeEach'
const BEFORE_ALL = '__beforeAll'
const AFTER_EACH = '__afterEach'
const AFTER_ALL = '__afterAll'

const yaml = require('yaml');

const defaultStream = () => {
  let stream = through()
  stream.pipe(tapSpec()).pipe(process.stdout)
  return stream
}

const _stream = defaultStream()

class SuiteTap {
  constructor(stream) {
    this.stream = stream || defaultStream()
  }

  _emit(str) {
    if (this.stream) {
      this.stream.write(str + "\n")
    }
  }

  start(testCount) {
    this._emit('TAP version 13')
    this._emit(`1..${testCount}`)
  }

  test(testNum, description, err, meta) {
    const resStr = !err ? 'ok' : 'not ok'

    let str = `${resStr} ${testNum} ${desc}`;

    if (meta) {
      str = str + "\n" + yaml.stringify(meta);
    }
    this._emit(str);
  }

  finish() {
    this.stream.end()
  }
}

module.exports = SuiteTap

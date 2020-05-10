const test = require('tape-promise/tape')
const _ = require('lodash')
const tapSpec = require('tap-spec')
const through = require('through2')
const stringifyObject = require('stringify-object')
const SuiteTap = require('./tap')

const BEFORE_EACH = '__beforeEach'
const BEFORE_ALL = '__beforeAll'
const AFTER_EACH = '__afterEach'
const AFTER_ALL = '__afterAll'
const SKIP = '__skip'

const isMagicKey = k => [BEFORE_EACH, BEFORE_ALL, AFTER_EACH, AFTER_ALL, SKIP].find(x => x === k)

const mergeCopy = (ctx, newCtx) => Object.assign({}, ctx, newCtx)

async function executeTestSuite(testSpecs, _ctx={}, _options={}) {
  const testPlan = makeTestPlan(testSpecs)
  const flatPlan = _.flattenDeep(testPlan).filter(x => x.isTest)

  flatPlan.forEach((x, i) => x.testNum = i)
  const testCount = flatPlan.length
  const tap = new SuiteTap()
  tap.start()
  tap._emit(`1..${testCount}`)

  try {
    const ctx = await executeTestPlan(testPlan, tap, _ctx)
    tap.finish()
    return ctx
  } catch (e) {
    console.error('Error while executing test suite:', e)
    tap.finish()
  }
}

async function executeTestPlan(testPlan, tap, _ctx={}) {
  let ctx = Object.assign({}, _ctx)

  for (let i = 0; i < testPlan.length; i++) {
    if (_.isArray(testPlan[i])) {
      const newCtx = await executeTestPlan(testPlan[i], tap, ctx)
      ctx = mergeCopy(ctx, newCtx)
    } else {
      const { path, thunk, isTest, testNum } = testPlan[i]

      try {
        const newCtx = await Promise.resolve(thunk(ctx))
        ctx = mergeCopy(ctx, newCtx)

        if (isTest) {
          tap.test(path, testNum, null)
        }
      } catch (e) {
        console.log('Error while running test:', path, e.message)
        if (isTest) {
          tap.test(path, testNum, e)
        } else {
          throw e
        }
      }
    }
  }
  return ctx
}

function makeTestPlan(testSpecs, path=[]) {
  return _testPlan(testSpecs, path, true)
}

function _arrayWrap(inp) {
  return _.isArray(inp) ? inp : [inp]
}


function _testPlan(testSpecs, path, isTest) {
  const withIndent = str => _.times(path.length * 4, () => ' ').join('') + str

  //console.log(withIndent(`----------------------------------`))
  //console.log(withIndent(`PATH: ${path}`))
  const pathStr = path.join(' | ')
  if (_.isFunction(testSpecs)) {
    return {
      path,
      thunk: testSpecs,
      isTest,
    }
  } else if (_.isArray(testSpecs)){
    if (testSpecs.find(x => !_.isFunction(x))) {
      throw new Error('Cant have object test plans inside of an array')
    }

    return testSpecs.map((plan, i) => _testPlan(plan, path.concat([`${i}`]), isTest))
  } else if (testSpecs) {
    const tests = _.chain(testSpecs)
      .toPairs()
      .filter(([k, v]) => !isMagicKey(k))
      //.tap((x) => console.log('x: ', x))
      .value()


    if (testSpecs[SKIP]) return []
    const beforeAll = testSpecs[BEFORE_ALL] && tests.length ? [_testPlan(testSpecs[BEFORE_ALL], path.concat([BEFORE_ALL]), false)] : []
    const afterAll = testSpecs[AFTER_ALL] && tests.length ? [_testPlan(testSpecs[AFTER_ALL], path.concat([AFTER_ALL]), false)] : []

    let r = [
      ...beforeAll,
      ...tests.map(([k, v]) => {
        const beforeEach = testSpecs[BEFORE_EACH] ? _testPlan(testSpecs[BEFORE_EACH], path.concat([BEFORE_EACH]), false) : []
        const afterEach = testSpecs[AFTER_EACH] ? _testPlan(testSpecs[AFTER_EACH], path.concat([AFTER_EACH]), false) : []
        const tests = _testPlan(v, path.concat([k]), isTest)

        const objectRes = [
          ...beforeEach,
          tests,
          ...afterEach,
        ]

        //console.log('objectRes:', objectRes)
        return objectRes
      }),
      ...afterAll,
    ]

    return r
  } else {
    throw new Error('test plan cant be nil')
  }
}

module.exports = {
  makeTestPlan,
  executeTestPlan,
  executeTestSuite,
  suite: executeTestSuite,
}

// testing "middleware"
// The test plan is a tree structure that defines a plan of testing.
//
// Middleware:
// where at each level there can be one or more test middleware.  the middleware could work by calling a callback, which would allow them to get access to the result of that test.
// this would allow a very extendable testing scenario.
//
// One middleware pattern: each middleware runs and can influence the "context" (eg. ctx) for inbound tests and the "result" of running the test.  However, to make
// it behave more intuitively, both the result and context must be objects (ie. not arrays).  The context at i+1 is just the result a key-by-key merge of the i into i-1.
//
// Most of the time the middleware will just be creating some data and merging it into a key
//
// Maybe every test would be a middleware.  Libraries and functionality would have the same structure.
//
// possible not to use exception throwing?
//
// every async must be called out
//


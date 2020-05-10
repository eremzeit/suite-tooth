
const _ = require('lodash')
const stringifyObject = require('stringify-object')
//const SuiteTap = require('./tap')
const tap = require('tap')

const BEFORE_EACH = '__beforeEach'
const BEFORE_ALL = '__beforeAll'
const AFTER_EACH = '__afterEach'
const AFTER_ALL = '__afterAll'
const SKIP = '__skip'
const ONLY = '__only'

const TEST_PREFIX_ONLY = 'ONLY'
const TEST_PREFIX_SKIP = 'SKIP'

const isMagicKey = k => [BEFORE_EACH, BEFORE_ALL, AFTER_EACH, AFTER_ALL, SKIP, ONLY].find(x => x === k)

const mergeCopy = (ctx, newCtx) => Object.assign({}, ctx, newCtx)

async function executeTestSuite(testSpecs, _options={}, _ctx={}, ) {
  ctx = await executeWithTap(testSpecs, _ctx, [], _options)
  return ctx
}

async function executeWithTap(testSpecs, ctx, path=[], options={}) {
  try {
    const res = await _executeWithTap(testSpecs, path, test, ctx)
    test.end()

    return res
  } catch (e) {
    console.error('Test suite failed: ', e)
  }
}

function hasDescFlaggedAsOnly(testSpecs, isRoot=true) {
  if (!isRoot && isOnlyNode(testSpecs)) {
    return true
  }

  // figure out if any tests are marked as "only" so that "only mode" can be enabled in node-tap
  if (_.isFunction(testSpecs)) {
    return false
  } else if (_.isArray(testSpecs)) {
    return false
  } else if (_.isObject(testSpecs)) {
    const tests = _.chain(testSpecs)
      .toPairs()
      .filter(([k, v]) => !isMagicKey(k))
      .value()

    if (testSpecs[SKIP]) {
      return false
    }

    return !!tests.find(function([pathKey, test]) {
      return pathKey.startsWith(TEST_PREFIX_ONLY) || hasDescFlaggedAsOnly(test, false)
    })
  } else {
    throw new Error('Invalid test spec format' + testSpecs.toString())
  }
}

function withoutMagicKeys(obj) {
  return _.chain(testSpecs)
    .toPairs()
    .filter(([k, test]) => !isMagicKey(k))
    //.filter(([k, test]) => !test[SKIP])
    .value()
}

function isTestObject(obj) {
  return _.isObject(obj) && !_.isArray(obj) && !_.isFunction(obj);
}

function isOnlyNode(obj, description) {
  return obj[ONLY] || description.startsWith(TEST_PREFIX_ONLY);
}

/*
 * a test plan is a data structure specifying the exact list of tests to be
 * run, as well as information how to run them.
 * eg.
 *
 *
 * [
 *   {
 *     description,
 *     fn,
 *     type,  //eg. TEST, BEFORE, AFTER, etc
 *   }
 * ]
 */
async function generateTestPlan(testSpecs, path) {
  const pathStr = _pathToName(path)
  const toExecute = []

  if (testSpecs[SKIP]) {
    return []
  }

  const tests = _.chain(testSpecs)
    .toPairs()
    .filter(([k, test]) => !isMagicKey(k))
    .filter(([k, test]) => !test[SKIP])
    .value()
  const requireOnly = hasDescFlaggedAsOnly(testSpecs)

  const beforeAll = testSpecs[BEFORE_ALL] && tests.length ? _arrayWrap(testSpecs[BEFORE_ALL]) : []
  const afterAll = testSpecs[AFTER_ALL] && tests.length ? _arrayWrap(testSpecs[AFTER_ALL]) : []

  //AOEU: you were in the middle of modifying the code below
  // to return a test plan rather than to execute the tests
  // directly.

 //
 //     if (beforeAll) {
 //       await chainPromises(beforeAll.map(async function(hook) {
 //         const newCtx = await hook(ctx)
 //         ctx = mergeCopy(ctx, newCtx)
 //       }))
 //     }

 //     if (testSpecs[BEFORE_EACH]) {
 //       const beforeEachHooks = _arrayWrap(testSpecs[BEFORE_EACH])

 //       beforeEachHooks.forEach(hook => {
 //         tapTest.beforeEach(function(done) {
 //           _withPromise(hook(ctx)).then((newCtx) => {
 //             ctx = mergeCopy(ctx, newCtx)
 //             done()
 //           })
 //         })
 //       })
 //     }

 //     if (testSpecs[AFTER_EACH]) {
 //       const afterEachHooks = _arrayWrap(testSpecs[AFTER_EACH])

 //       afterEachHooks.forEach(hook => {
 //         tapTest.afterEach(function(done) {
 //           _withPromise(hook(ctx)).then((newCtx) => {
 //             ctx = mergeCopy(ctx, newCtx)
 //             done()
 //           })
 //         })
 //       })
 //     }

 //     try {
 //       const testThenables = tests.filter(([pathKey, test]) => {
 //         return !(test.__skip || pathKey.startsWith(TEST_PREFIX_SKIP))
 //       }).map(async function([pathKey, test]) {
 //         if (pathKey.startsWith(TEST_PREFIX_ONLY)) {
 //           test = only(test)
 //         }

 //         const newPath = path.concat([pathKey])
 //         const pathStr = pathKey

 //         await tapTest.test(pathStr, async (subTest) => {
 //           try {
 //             const newCtx = await _executeWithTap(test, newPath, subTest, ctx)
 //             ctx = mergeCopy(ctx, newCtx)

 //             subTest.end()
 //           } catch (e) {
 //             console.error('error: ', e)
 //             subTest.end()
 //           }
 //         })
 //       })

 //       await chainPromises(testThenables)
 //     } catch (e) {
 //       console.log('error:', e)
 //     }

 //     if (afterAll) {
 //       await chainPromises(afterAll.map(async function(hook) {
 //         const newCtx = await hook(ctx)
 //         ctx = mergeCopy(ctx, newCtx)
 //       }))
 //     }
 //   } else {
 //     const msg = 'test plan cant be nil'
 //     console.error(msg)
 //     throw new Error(msg)
 //   }
 // } catch (e) {
 //   console.error('Test execution failure: ', e)
 //   throw e
 // }

 // return ctx
}

async function _executeWithTap(testSpecs, path, parentTapTest, _ctx={}) {
  const pathStr = _pathToName(path)
  let ctx = _ctx

  let tapTest = parentTapTest
  try {
    if (_.isFunction(testSpecs) || testSpecs.__testFn) {
      const fn = testSpecs.__testFn || testSpecs

      try {
        const newCtx = await fn(ctx, tapTest)
        ctx = mergeCopy(ctx, newCtx)
      } catch (e) {
        //console.log('Error while individual test run:', e)
        tapTest.error(e)
      }
    } else if (_.isArray(testSpecs) || testSpecs.__testArray) {
      const testArray = testSpecs.__testArray || testSpecs

      const onlyRequired = !!testArray.find((testFn) => testFn[ONLY])

      const testProms = testArray.filter((_testFn) => {
        return !onlyRequired || _testFn[ONLY]
      }).map((_testFn, i) => {
        const testFn = _testFn.__testFn || _testFn

        return tapTest.test(`${pathStr}-${i}`, async function(tapSubTest) {
          try {
            const newCtx = await testFn(ctx, tapSubTest)
            ctx = mergeCopy(ctx, newCtx)
            tapSubTest.end()
          } catch (e) {
            console.log('error while running test in series:', e)
            tapSubTest.fail(e.message)
            tapSubTest.end()
            throw e
          }
        })
      })

      return chainPromises(testProms).then(() => {
        return ctx
      })
    } else if (testSpecs) {
      if (testSpecs[SKIP]) {
        tap.skip(pathStr)
        return ctx
      }

      let tests = _.chain(testSpecs)
        .toPairs()
        .filter(([k, test]) => !isMagicKey(k))
        .filter(([k, test]) => !test[SKIP])
        .value()

      const requireOnly = hasDescFlaggedAsOnly(testSpecs)
      if (requireOnly) {
        tests = tests.filter(([_k, test]) => (test[ONLY] || _k.startsWith(TEST_PREFIX_ONLY)) || hasDescFlaggedAsOnly(test))
      }

      if (!tests.length) {
        return ctx
      }

      const beforeAll = testSpecs[BEFORE_ALL] && tests.length ? _arrayWrap(testSpecs[BEFORE_ALL]) : []
      const afterAll = testSpecs[AFTER_ALL] && tests.length ? _arrayWrap(testSpecs[AFTER_ALL]) : []

      if (beforeAll) {
        await chainPromises(beforeAll.map(async function(hook) {
          const newCtx = await hook(ctx)
          ctx = mergeCopy(ctx, newCtx)
        }))
      }

      if (testSpecs[BEFORE_EACH]) {
        const beforeEachHooks = _arrayWrap(testSpecs[BEFORE_EACH])

        beforeEachHooks.forEach(hook => {
          tapTest.beforeEach(function(done) {
            _withPromise(hook(ctx)).then((newCtx) => {
              ctx = mergeCopy(ctx, newCtx)
              done()
            })
          })
        })
      }

      if (testSpecs[AFTER_EACH]) {
        const afterEachHooks = _arrayWrap(testSpecs[AFTER_EACH])

        afterEachHooks.forEach(hook => {
          tapTest.afterEach(function(done) {
            _withPromise(hook(ctx)).then((newCtx) => {
              ctx = mergeCopy(ctx, newCtx)
              done()
            })
          })
        })
      }

      try {
        const testThenables = tests.filter(([pathKey, test]) => {
          return !(test.__skip || pathKey.startsWith(TEST_PREFIX_SKIP))
        }).map(async function([pathKey, test]) {
          if (pathKey.startsWith(TEST_PREFIX_ONLY)) {
            test = only(test)
          }

          const newPath = path.concat([pathKey])
          const pathStr = pathKey

          await tapTest.test(pathStr, async (subTest) => {
            try {
              const newCtx = await _executeWithTap(test, newPath, subTest, ctx)
              ctx = mergeCopy(ctx, newCtx)

              subTest.end()
            } catch (e) {
              console.error('error: ', e)
              subTest.end()
            }
          })
        })

        await chainPromises(testThenables)
      } catch (e) {
        console.log('error:', e)
      }

      if (afterAll) {
        await chainPromises(afterAll.map(async function(hook) {
          const newCtx = await hook(ctx)
          ctx = mergeCopy(ctx, newCtx)
        }))
      }
    } else {
      const msg = 'test plan cant be nil'
      console.error(msg)
      throw new Error(msg)
    }
  } catch (e) {
    console.error('Test execution failure: ', e)
    throw e
  }

  return ctx
}

async function executeRootSuite(suiteSpecs, options={}) {
  const tapSpec = require('tap-spec')
  const tapTest = new tap.Test()
  options.nodeTapTest = tapTest

  tapTest.pipe(tapSpec()).pipe(process.stdout)
  const ctx = await executeTestSuite(suiteSpecs, options)
}

function skip(testSpec) {
  if (_.isFunction(testSpec)) {
    return {
      __testFn: testSpec,
      [SKIP]: true,
    }
  } else if (testSpec) {
    return Object.assign({}, testSpec, {
      [SKIP]: true,
    })
  }
}

function only(testSpec) {
  if (_.isFunction(testSpec)) {
    return {
      __testFn: testSpec,
      [ONLY]: true,
    }
  } else if (testSpec) {
    return Object.assign({}, testSpec, {
      [ONLY]: true,
    })
  }
}

module.exports = {
  executeTestSuite,
  suite: executeTestSuite,
  executeRootSuite,
  only,
  skip,
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

function _arrayWrap(inp) {
  return _.isArray(inp) ? inp : [inp]
}

function _pathToName(path) {
  if (_.isArray(path)) {
    return path.join(' > ')
  } else {
    return path
  }
}

function _withPromise(x) {
  x = x || {}
  return !!x.then ? x : Promise.resolve(x)
}

function chainPromises(promises) {
  let p = Promise.resolve()

  promises.forEach(_p => {
    p = p.then(() => _p)
  })

  return p
}

// taken from previous version of code.  it pregenerates a test plan
// rather than executing everything inline.
// function _testPlan(testSpecs, path, isTest) {
//   const withIndent = str => _.times(path.length * 4, () => ' ').join('') + str
//
//   //console.log(withIndent(`----------------------------------`))
//   //console.log(withIndent(`PATH: ${path}`))
//   const pathStr = path.join(' | ')
//   if (_.isFunction(testSpecs)) {
//     return {
//       path,
//       thunk: testSpecs,
//       isTest,
//     }
//   } else if (_.isArray(testSpecs)){
//     if (testSpecs.find(x => !_.isFunction(x))) {
//       throw new Error('Cant have object test plans inside of an array')
//     }
//
//     return testSpecs.map((plan, i) => _testPlan(plan, path.concat([`${i}`]), isTest))
//   } else if (testSpecs) {
//     const tests = _.chain(testSpecs)
//       .toPairs()
//       .filter(([k, v]) => !isMagicKey(k))
//       //.tap((x) => console.log('x: ', x))
//       .value()
//
//
//     if (testSpecs[SKIP]) return []
//     const beforeAll = testSpecs[BEFORE_ALL] && tests.length ? [_testPlan(testSpecs[BEFORE_ALL], path.concat([BEFORE_ALL]), false)] : []
//     const afterAll = testSpecs[AFTER_ALL] && tests.length ? [_testPlan(testSpecs[AFTER_ALL], path.concat([AFTER_ALL]), false)] : []
//
//     let r = [
//       ...beforeAll,
//       ...tests.map(([k, v]) => {
//         const beforeEach = testSpecs[BEFORE_EACH] ? _testPlan(testSpecs[BEFORE_EACH], path.concat([BEFORE_EACH]), false) : []
//         const afterEach = testSpecs[AFTER_EACH] ? _testPlan(testSpecs[AFTER_EACH], path.concat([AFTER_EACH]), false) : []
//         const tests = _testPlan(v, path.concat([k]), isTest)
//
//         const objectRes = [
//           ...beforeEach,
//           tests,
//           ...afterEach,
//         ]
//
//         //console.log('objectRes:', objectRes)
//         return objectRes
//       }),
//       ...afterAll,
//     ]
//
//     return r
//   } else {
//     throw new Error('test plan cant be nil')
//   }
// }



const { suite, executeTestSuite, executeRootSuite, skip, only } = require('./suite-tooth')
const { expect } = require('chai')
const stripIndent = require('common-tags/lib/stripIndent')
const Diff = require('diff')

const Tap = require('tap')

const _incrCount = async (ctx) => {
  return {
    count: (ctx.count || 0) + 1,
  }
}

//tap.pipe(process.stdout)
//tap.runOnly = true
executeRootSuite({
  'tests in series': async () => {
    let res = []

    return executeSuiteAndVerify({
      'FOO': [
        async () => {
          return _delay(10).then((ctx, test) => {
            res.push(1)
            return { foo: 1 }
          })
        },

        async (ctx, test) => {
          res.push(2)
          test.same(ctx, {foo: 1})
        }
      ],
    }, (ctx, tapOutput) => {
      const expected = stripIndent`
        TAP version 13
        # Subtest: FOO
            # Subtest: FOO-0
                1..0
            ok 1 - FOO-0

            # Subtest: FOO-1
                ok 1 - should be equivalent
                1..1
            ok 2 - FOO-1

            1..2
        ok 1 - FOO
        1..1`

      expectTapIsEqual(tapOutput, expected)
    })
  },

  'beforeEach hooks should execute': async (t) => {
    return executeSuiteAndVerify({
      'FOO': {
        'BAR': {
          __beforeEach: [_incrCount, _incrCount, _incrCount],

          'BAZ' : async (ctx) => {
            return {
              baz: true,
            }
          },
        }
      },
    }, (ctx, tapOutput) => {
      expectTapIsEqual(tapOutput, stripIndent`
        TAP version 13
        # Subtest: FOO
            # Subtest: BAR
                # Subtest: BAZ
                    1..0
                ok 1 - BAZ
                1..1
            ok 1 - BAR
            1..1
        ok 1 - FOO
        1..1`)


      expect(ctx).to.eql({
        count: 3,
        baz: true,
      })
    })
  },


  'Each of the types of hooks': async () => {
    return executeSuiteAndVerify({
      'FOO': {
        __beforeAll: [async (ctx) => {
          return {
            count: 0,
          }
        }],

        __afterAll: async (ctx) => {
          return {
            afterAll: typeof ctx.afterAll !== 'undefined' ? ctx.afterAll + 1 : 1,
          }
        },

        __beforeEach: [async (ctx) => {
          return {
            count: ctx.count + 1
          }
        }],

        __afterEach: [],

        'BAR': async () => {
          return {
            bar: true,
          }
        }
      },
    }, (ctx, tapOutput) => {
      expectTapIsEqual(tapOutput, stripIndent`
        TAP version 13
        # Subtest: FOO
            # Subtest: BAR
                1..0
            ok 1 - BAR
            1..1
        ok 1 - FOO
        1..1`)

      expect(ctx).to.eql({
        bar: true,
        count: 1,
        afterAll: 1,
      })
    })
  },

  'if there are no test cases, the lifecycle hooks dont run': async () => {
    return executeSuiteAndVerify({
        __beforeAll: [(ctx) => {
          return {
            count: 0,
          }
        }],

        __afterAll: [],
        __beforeEach: [(ctx) => {
          return {
            count: ctx.count + 1
          }
        }],

        __afterEach: [],
    }, (ctx, tapOutput) => {
      expect(ctx.count).to.be.undefined
    })
  },

  'flagging tests with SKIP': {
    'tests marked with skip dont run': () => {
      return executeSuiteAndVerify({
        'test with skip': skip((ctx) => {
          return {
            foo: true,
          }
        }),
        'test without only': (ctx) => {
          return {
            bar: true,
          }
        }
      }, (ctx, tapOutput) => {
        expect(ctx.foo).to.be.undefined
        expect(ctx.bar).to.be.true
      })
    },

    'tests prefixed with SKIP dont run': () => {
      return executeSuiteAndVerify({
        'SKIP test with skip': (ctx) => {
          return {
            foo: true,
          }
        },
        'test without only': (ctx) => {
          return {
            bar: true,
          }
        }
      }, (ctx, tapOutput) => {
        expect(ctx.foo).to.be.undefined
        expect(ctx.bar).to.be.true
      })
    }
  },

  'flagging tests with ONLY': {
    'if a test function is marked as only, the others are skipped': async () => {
      return executeSuiteAndVerify({
        'test with only': only((ctx) => {
          return {
            foo: true,
          }
        }),
        'test without only': (ctx) => {
          return {
            bar: true,
          }
        }
      }, (ctx, tapOutput) => {
        expect(ctx.foo).to.be.true
        expect(ctx.bar).to.be.undefined
      })
    },

    'prefixing the test key with the ONLY string flags that test as ONLY': async () => {
      return executeSuiteAndVerify({
        'ONLY: test with only': (ctx) => {
          return {
            foo: true,
          }
        },

        'test without only': (ctx) => {
          return {
            bar: true,
          }
        }
      }, (ctx, tapOutput) => {
        expect(ctx.foo).to.be.true
        expect(ctx.bar).to.be.undefined
      })
    },

    'if no descendant tests are marked as only then all descendant tests run': async () => {
      return executeSuiteAndVerify({
        'foo': only({
          'foo-1': () => {
            return {
              count: 1,
            }
          },
          'foo-2': (ctx) => {
            return {
              count: (ctx.count || 0) + 1
            }
          }
        }),

        'bar': () => {
          return { bar: true }
        },
      }, (ctx, tapOutput) => {
        expect(ctx).to.eql({
          count: 2
        })
      })
    },

    'tests flagged as "only" within an array': async () => {
      return executeSuiteAndVerify({
        'foo': [
          only(() => {
            return {
              count: 1,
            }
          }),

          (ctx) => {
            return {
              count: ctx.count + 1
            }
          }
        ]
      }, (ctx, tapOutput) => {
        expect(ctx).to.eql({
          count: 1
        })
      })
    },
  },


  'when there is an error thrown in a testing function, the tap output shows a failure': async () => {
    return executeSuiteAndVerify({
      'FOO': () => {
        throw new Error('foo error')
      },
    }, (ctx, tapOutput) => {
      expect(ctx).to.eql({})

      expectTapIsEqual(tapOutput.replace(/(?<=stack[:] [|][-])[\s\S]*?\.\.\./mg, ''), stripIndent`
        TAP version 13
        # Subtest: FOO
            not ok 1 - foo error
              ---
              found:
                name: Error
                stack: |-
            1..1
            # failed 1 test
        not ok 1 - FOO
        1..1
        # failed 1 test`)
    })
  },

  'beforeEach hooks should execute': async () => {
    return executeSuiteAndVerify({
      'FOO': {
        __beforeAll: [_incrCount],

        'BAR': {
          __beforeEach: [_incrCount, _incrCount, _incrCount],

          'BAZ' : async (ctx) => {
            return {
              baz: true,
            }
          },
        }
      },
    }, (ctx, tapOutput) => {
      expect(ctx).to.eql({count: 4, baz: true})
      expectTapIsEqual(tapOutput, stripIndent`
        TAP version 13
        # Subtest: FOO
            # Subtest: BAR
                # Subtest: BAZ
                    1..0
                ok 1 - BAZ
                1..1
            ok 1 - BAR
            1..1
        ok 1 - FOO
        1..1`)
    })
  },

  'empty suite': async (t) => {
    return executeSuiteAndVerify({
      FOO: {}
    }, (ctx, tapOutput) => {
      const expected = stripIndent`
        TAP version 13
        # Subtest: FOO
            1..0
        ok 1 - FOO
        1..1
      `

      expectTapIsEqual(tapOutput, expected)
    })
  },

  'chainPromises': async () => {
    return chainPromises([
      () => Promise.resolve([]),
      (inp) => Promise.resolve(inp.concat([1])),
      (inp) => Promise.resolve(inp.concat([2])),
      (inp) => Promise.resolve(inp.concat([3])),
    ]).then((res) => {
      expect(res).to.eql([1,2,3])
    })
  }
})

function normalizeTap(tap) {
  return tap.replace(/# time=.*$/gm, '').replace(/ *$/gm, '').replace(/\n$/gm, '').replace(/^ *$/gm, '')
}

function expectTapIsEqual(tap1, tap2) {
  tap1 = normalizeTap(tap1)
  tap2 = normalizeTap(tap2)
  if (tap1 !== tap2) {
    console.error('Diff.diffChars(tap1, tap2):', Diff.diffChars(tap1, tap2))
    throw new Error(`Tap strings differ:\n---\n${tap1}\n---\n${tap2}\n---\n`)
  }
}

async function executeSuiteAndVerify(suite, assertFn) {
  let tapOutput
  const ctx = await executeTestSuite(suite, { onTapComplete: output => tapOutput = output})

  try {
    return Promise.resolve(assertFn(ctx, tapOutput))
  } catch (e) {
    //console.error('Error while running assert: ')
    console.error(e)
    throw e
  }
}

function chainPromises(promises) {
  let p = Promise.resolve()

  promises.forEach(_p => {
    p = p.then(_p)
  })

  return p
}

function _delay(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms)
  })
}
)

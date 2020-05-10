const { suite, makeTestPlan, executeTestPlan } = require('./suite-tooth')
const { expect } = require('chai')
const SuiteTap = require('./tap')

function testMakeEmptyTestPlan() {
  const testPlan = makeTestPlan({
    'FOOBAR': {
      __beforeAll: [async (ctx) => {
        return {
          count: 0,
        }
      }],

      __afterAll: [],
      __beforeEach: [async (ctx) => {
        return {
          count: ctx.count + 1
        }
      }],

      __afterEach: [],
    },
  })

  //console.log('testPlan:', testPlan)
  expect(testPlan).to.eql([])
}

function testMakeSimpleTestPlan() {
  const testPlan = makeTestPlan({
    'FOO': async (ctx) => {},
  })

  expect(testPlan[0][0].path).to.eql(['FOO'])
}

function testMakeTestPlan() {
  const testPlan = makeTestPlan({
    'FOO': {
      __beforeAll: [async (ctx) => {
        return {
          count: 0,
        }
      }],

      __beforeEach: [async (ctx) => {
        return {
          count: ctx.count + 1
        }
      }],


      'BAR': async (ctx) => {
        return {}
      },
    },
  })

  //console.log('testPlan:', testPlan)
  expect(testPlan[0][0][0][0].path).to.eql(['FOO', '__beforeAll', '0'])
}

async function testExecuteTestPlan() {
  const tap = new SuiteTap()

  const testPlan = makeTestPlan({
    'FOO': {
      __beforeAll: [async (ctx) => {
        return {
          count: 0,
        }
      }],

      __beforeEach: [async (ctx) => {
        return {
          count: ctx.count + 1
        }
      }],


      'BAR': async (ctx) => {
        return {}
      },
      'BAZ': async (ctx) => {
        return {}
      },
    },
  })

  const ctx = await executeTestPlan(testPlan, tap)
  expect(ctx).to.eql({count: 2})
}


//testMakeTestPlan()
//testMakeSimpleTestPlan()
testExecuteTestPlan()

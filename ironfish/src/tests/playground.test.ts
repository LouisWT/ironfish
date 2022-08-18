/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

import { RollingFilter } from '@ironfish/bfilter'
import { randomBytesBuffer, randomBytesString, randomBytesVec } from '@ironfish/rust-nodejs'
import LRU from 'blru'
import { BufferMap } from 'buffer-map'
import { randomBytes } from 'crypto'
import { BenchUtils } from '../utils/bench'
import { PromiseUtils } from '../utils/promise'

class LRUBufferSet {
  private set = new Set<string>()
  private maxSize: number

  constructor(maxSize: number) {
    this.maxSize = maxSize
  }

  add(value: Buffer) {
    const stringValue = value.toString('hex')

    // Deleting and re-adding will add the value to the front of the set
    if (this.set.has(stringValue)) {
      this.set.delete(stringValue)
    }

    this.set.add(stringValue)

    if (this.set.size > this.maxSize) {
      const first = this.set.values().next()
      this.set.delete(first.value)
    }
  }

  delete(value: Buffer) {
    const stringValue = value.toString('hex')
    this.set.delete(stringValue)
  }

  has(value: Buffer): boolean {
    const stringValue = value.toString('hex')
    return this.set.has(stringValue)
  }

  clear() {
    this.set.clear()
  }
}

const pauseAndGc = async (milliseconds: number) => {
  await PromiseUtils.sleep(milliseconds)
  for (let i = 0; i < 5; ++i) {
    global.gc && global.gc()
  }
}

const withSegment = async (title: string, fn: () => any): Promise<string> => {
  const segment = BenchUtils.startSegment()
  await fn()
  const segmentResults = BenchUtils.endSegment(segment)
  return BenchUtils.renderSegment(segmentResults, title)
}

describe('test playground', () => {
  it.only('compare randomBytes', async () => {
    const TEST_COUNT = 1_000_000

    let bufList = []

    const segmentCResults = await withSegment('Rust String to Buffer', async () => {
      for (let i = 0; i < TEST_COUNT; i += 1) {
        const x = Buffer.from(randomBytesString(32), 'hex')
        if (i == 5) {
          bufList.push(x)
        }
      }
      // await pauseAndGc(1000)
    })

    await pauseAndGc(1000)

    const segmentDResults = await withSegment('Rust JsBuffer', () => {
      for (let i = 0; i < TEST_COUNT; i += 1) {
        const x = randomBytesVec(32)
        if (i == 5) {
          bufList.push(x)
        }
      }
      // await pauseAndGc(1000)
    })

    await pauseAndGc(1000)

    const segmentAResults = await withSegment('NodeJS Buffer', async () => {
      for (let i = 0; i < TEST_COUNT; i += 1) {
        const x = randomBytes(32)
        if (i == 5) {
          bufList.push(x)
        }
      }
      // await pauseAndGc(1000)
    })

    await pauseAndGc(1000)

    const segmentBResults = await withSegment('Rust Buffer', async () => {
      for (let i = 0; i < TEST_COUNT; i += 1) {
        const x = randomBytesBuffer(32)
        if (i == 5) {
          bufList.push(x)
        }
      }
      // await pauseAndGc(1000)
    })

    await pauseAndGc(1000)



    console.log(segmentAResults)
    console.log(segmentBResults)
    console.log(segmentCResults)
    console.log(segmentDResults)

    expect(true).toBe(false)
  }, 600000)

  it('testing buffer stuff', async () => {
    const TEST_COUNT = 1_000_000
    const LRU_SIZE = 50_000

    const lru = new LRU<Buffer, boolean>(LRU_SIZE, null, BufferMap)
    const bset = new LRUBufferSet(LRU_SIZE)
    const rfilter = new RollingFilter(LRU_SIZE, 0.000001)

    const segmentAResults = await withSegment('LRU+BufferMap', () => {
      for (let i = 0; i < TEST_COUNT; i += 1) {
        const x = Buffer.from(randomBytesString(32))
        lru.set(x, true)
        lru.has(x)
      }
    })

    await pauseAndGc(1000)

    const segmentBResults = await withSegment('LRUBufferSet', () => {
      for (let i = 0; i < TEST_COUNT; i += 1) {
        const x = Buffer.from(randomBytesString(32))
        bset.add(x)
        bset.has(x)
      }
    })

    await pauseAndGc(1000)

    const segmentCResults = await withSegment('RollingFilter', () => {
      for (let i = 0; i < TEST_COUNT; i += 1) {
        const x = Buffer.from(randomBytesString(32))
        rfilter.add(x)
        rfilter.test(x)
      }
    })

    await pauseAndGc(1000)

    console.log(segmentAResults)
    console.log(segmentBResults)
    console.log(segmentCResults)

    expect(true).toBe(false)
  }, 600000)
})

import { describe, it, expect } from 'vitest'
import {
  fetchContestStatistics,
  fetchSystemStatus,
} from './api'

describe('api', () => {
  describe('fetchContestStatistics', () => {
    it('devuelve un objeto con total_contests, active_contests, total_schools, total_subjects y contests_by_month', async () => {
      const result = await fetchContestStatistics()
      expect(result).toHaveProperty('total_contests')
      expect(result).toHaveProperty('active_contests')
      expect(result).toHaveProperty('total_schools')
      expect(result).toHaveProperty('total_subjects')
      expect(result).toHaveProperty('contests_by_month')
      expect(typeof result.total_contests).toBe('number')
      expect(typeof result.active_contests).toBe('number')
      expect(Array.isArray(result.contests_by_month)).toBe(true)
    })
  })

  describe('fetchSystemStatus', () => {
    it('devuelve un objeto con api_status y scheduler', async () => {
      const result = await fetchSystemStatus()
      expect(result).toHaveProperty('api_status')
      expect(result).toHaveProperty('scheduler')
      expect(typeof result.api_status).toBe('string')
      expect(result.scheduler).toBeDefined()
      expect(result.scheduler).toHaveProperty('available_sources')
      expect(Array.isArray(result.scheduler.available_sources)).toBe(true)
    })
  })
})

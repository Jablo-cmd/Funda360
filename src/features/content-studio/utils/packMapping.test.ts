import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Guards the machine-readable objective mapping for the Grade 4 Mathematics Term 1 pack against the pack itself.
// Nothing here can make the pack "verified": it checks that the mapping stays truthful about being unverified.
const root = resolve(__dirname, '../../../..')
const sql = readFileSync(resolve(root, 'supabase/content/grade4-mathematics-2026-term1.sql'), 'utf8')
const json = JSON.parse(readFileSync(resolve(root, 'docs/sources/caps/grade4-mathematics-2026-term1-objectives.json'), 'utf8')) as {
  status: string
  objectives: Array<Record<string, unknown>>
}
const csv = readFileSync(resolve(root, 'docs/sources/caps/grade4-mathematics-2026-term1-objectives.csv'), 'utf8')

const sqlObjectives = [...sql.matchAll(/insert into public\.curriculum_objectives [^\n]*?\$t\$(G4\.MATH\.2026\.T1\.[A-Z]+\.\d+)\$t\$, \$t\$(.*?)\$t\$/g)].map(m => ({
  code: m[1],
  description: m[2],
}))

describe('Grade 4 Mathematics Term 1 objective mapping', () => {
  it('lists the same 27 objectives, in the same words, as the pack', () => {
    expect(sqlObjectives).toHaveLength(27)
    expect(json.objectives.map(o => o.objective_id)).toEqual(sqlObjectives.map(o => o.code))
    expect(json.objectives.map(o => o.description)).toEqual(sqlObjectives.map(o => o.description))
  })

  it('keeps every row pending, indexed only, with no page claimed', () => {
    for (const o of json.objectives) {
      expect(o.verification_status).toBe('pending')
      expect(o.source_status).toBe('indexed')
      expect(o.source_page).toBe('NOT VERIFIED')
      expect(o.reviewer).toBe('REQUIRES HUMAN CURRICULUM REVIEW')
    }
    expect(json.status).toBe('DRAFT - NOT VERIFIED - NOT APPROVED - NOT PUBLISHED')
  })

  it('has a CSV with one data row per objective and the same ids', () => {
    const lines = csv.trim().split('\n')
    expect(lines[0]?.split(',')).toEqual(expect.arrayContaining(['objective_id', 'verification_status', 'source_page', 'source_status']))
    const ids = lines.filter(l => l.startsWith('G4.MATH.2026.T1.')).map(l => l.split(',')[0])
    expect(ids).toEqual(sqlObjectives.map(o => o.code))
    expect(csv).not.toMatch(/,verified,|,reviewed,/)
  })

  it('records the assignment duration as recorded and invents no marks or weighting', () => {
    const fa = json.objectives.find(o => o.objective_id === 'G4.MATH.2026.T1.FA.01')
    expect(String(fa?.description)).toMatch(/three hours/)
    expect(String(fa?.description)).not.toMatch(/\d+\s*marks|weighting|%/i)
  })

  it('has no Common Fractions objective in the reconciled pack', () => {
    expect(sql).not.toMatch(/G4\.MATH\.T1\.FRAC/)
    expect(JSON.stringify(json)).not.toMatch(/FRAC/)
  })
})

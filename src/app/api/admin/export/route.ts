import ExcelJS from 'exceljs'
import { getSessionEmail } from '@/lib/session'
import { isAdmin } from '@/lib/auth/isAdmin'
import { getSupabaseAdminClient } from '@/lib/supabase/admin'
import { ROUND_LABELS, ROUND_ORDER } from '@/lib/constants/rounds'
import type { RoundName } from '@/types/app'

// ── helpers ──────────────────────────────────────────────────────────────────

function teamName(ref: unknown): string {
  if (!ref) return ''
  const t = Array.isArray(ref) ? ref[0] : ref
  return (t as { name?: string })?.name ?? ''
}

function header(
  ws: ExcelJS.Worksheet,
  row: number,
  label: string,
  cols: number,
  bg = '1E3A5F'
) {
  ws.mergeCells(row, 1, row, cols)
  const cell = ws.getCell(row, 1)
  cell.value = label
  cell.font = { bold: true, color: { argb: 'FFFFFF' }, size: 11 }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } }
  cell.alignment = { vertical: 'middle', horizontal: 'left' }
  ws.getRow(row).height = 18
}

function colHeaders(ws: ExcelJS.Worksheet, row: number, labels: string[]) {
  const r = ws.getRow(row)
  labels.forEach((label, i) => {
    const cell = r.getCell(i + 1)
    cell.value = label
    cell.font = { bold: true, size: 9 }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E2E8F0' } }
    cell.alignment = { horizontal: 'center', vertical: 'middle' }
    cell.border = {
      bottom: { style: 'thin', color: { argb: 'CBD5E1' } },
    }
  })
  ws.getRow(row).height = 16
}

function dataCell(
  ws: ExcelJS.Worksheet,
  row: number,
  col: number,
  value: ExcelJS.CellValue,
  opts?: { bold?: boolean; align?: ExcelJS.Alignment['horizontal']; fill?: string; numFmt?: string }
) {
  const cell = ws.getCell(row, col)
  cell.value = value
  if (opts?.bold) cell.font = { bold: true }
  if (opts?.align) cell.alignment = { horizontal: opts.align }
  if (opts?.fill) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: opts.fill } }
  if (opts?.numFmt) cell.numFmt = opts.numFmt
  return cell
}

// ── pagination helper ─────────────────────────────────────────────────────────
// Supabase/PostgREST caps results at ~1 000 rows by default.  For tables that
// can exceed that (predictions, group_qualifications) we paginate so every row
// is included in the export.

const PAGE_SIZE = 1000

async function fetchAllRows<T>(
  buildQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> },
): Promise<T[]> {
  const all: T[] = []
  let from = 0
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1)
    if (error || !data || data.length === 0) break
    all.push(...data)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all
}

// ── main handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const email = await getSessionEmail()
  if (!await isAdmin(email)) {
    return new Response('Unauthorized', { status: 401 })
  }

  const admin = getSupabaseAdminClient()

  // Fetch all data in parallel.  Small tables use a single query; large tables
  // (predictions, qualifications) are paginated to avoid the default row cap.
  const [
    { data: entries },
    { data: matches },
    predictions,
    qualifications,
    { data: teams },
    { data: groups },
    { data: rounds },
  ] = await Promise.all([
    admin.from('entries').select('id, name, user_email, total_points').order('total_points', { ascending: false }),
    admin.from('matches').select(`
      id, match_number, scheduled_at, home_score, away_score, placeholder_home, placeholder_away,
      home_team:teams!matches_home_team_id_fkey(id, name, flag_emoji),
      away_team:teams!matches_away_team_id_fkey(id, name, flag_emoji),
      winner_team:teams!matches_winner_team_id_fkey(id, name),
      round:rounds!matches_round_id_fkey(id, name, sort_order),
      group:groups!matches_group_id_fkey(id, name)
    `).order('match_number'),
    fetchAllRows<{
      entry_id: string; match_id: string;
      predicted_home: number | null; predicted_away: number | null;
      predicted_winner_team_id: string | null; points_awarded: number | null;
    }>(() => admin.from('predictions').select('entry_id, match_id, predicted_home, predicted_away, predicted_winner_team_id, points_awarded')),
    fetchAllRows<{
      entry_id: string; group_id: string; points_awarded: number | null;
      team_1st: { name: string }[] | null; team_2nd: { name: string }[] | null; team_3rd: { name: string }[] | null;
      group: { id: string; name: string }[] | null;
    }>(() => admin.from('group_qualifications').select(`
      entry_id, group_id, points_awarded,
      team_1st:teams!group_qualifications_predicted_1st_team_id_fkey(name),
      team_2nd:teams!group_qualifications_predicted_2nd_team_id_fkey(name),
      team_3rd:teams!group_qualifications_predicted_3rd_team_id_fkey(name),
      group:groups!group_qualifications_group_id_fkey(id, name)
    `).order('group_id')),
    admin.from('teams').select('id, name'),
    admin.from('groups').select('id, name').order('name'),
    admin.from('rounds').select('id, name, status, sort_order').order('sort_order'),
  ])

  // ── Index data ──────────────────────────────────────────────────────────────
  type TeamRow = { id: string; name: string }
  const teamById = Object.fromEntries((teams ?? []).map((t) => [t.id, t as TeamRow]))

  // Predictions keyed by entry_id → match_id
  type PredRow = (typeof predictions)[number]
  const predByEntryMatch: Record<string, Record<string, PredRow>> = {}
  for (const p of predictions) {
    if (!predByEntryMatch[p.entry_id]) predByEntryMatch[p.entry_id] = {}
    predByEntryMatch[p.entry_id][p.match_id] = p
  }

  // Qualifications keyed by entry_id → group_id
  type QualRow = (typeof qualifications)[number]
  const qualByEntryGroup: Record<string, Record<string, QualRow>> = {}
  for (const q of qualifications) {
    if (!qualByEntryGroup[q.entry_id]) qualByEntryGroup[q.entry_id] = {}
    const grp = Array.isArray(q.group) ? q.group[0] : q.group
    if (grp?.id) qualByEntryGroup[q.entry_id][grp.id] = q
  }

  // Matches grouped by round name
  type MatchRow = NonNullable<typeof matches>[number]
  const matchesByRound: Record<string, MatchRow[]> = {}
  for (const m of matches ?? []) {
    const rnd = Array.isArray(m.round) ? m.round[0] : m.round
    const rndName = rnd?.name as string | undefined
    if (!rndName) continue
    if (!matchesByRound[rndName]) matchesByRound[rndName] = []
    matchesByRound[rndName].push(m)
  }

  // ── Build workbook ──────────────────────────────────────────────────────────
  const wb = new ExcelJS.Workbook()
  wb.creator = 'Quiniela 2026'
  wb.created = new Date()

  // ── Summary sheet ───────────────────────────────────────────────────────────
  const summary = wb.addWorksheet('Leaderboard')
  summary.columns = [
    { width: 6 }, { width: 28 }, { width: 28 }, { width: 14 },
  ]
  header(summary, 1, 'Quiniela 2026 — Leaderboard', 4, '0F172A')
  colHeaders(summary, 2, ['Rank', 'Entry Name', 'Email', 'Total Points'])
  ;(entries ?? []).forEach((e, i) => {
    const r = summary.getRow(i + 3)
    r.values = [i + 1, e.name, e.user_email, e.total_points]
    r.getCell(1).alignment = { horizontal: 'center' }
    r.getCell(4).alignment = { horizontal: 'center' }
    r.getCell(4).font = { bold: true }
    if (i % 2 === 0) {
      [1, 2, 3, 4].forEach((c) => {
        r.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'F8FAFC' } }
      })
    }
    r.height = 15
  })

  // ── Per-entry sheets ────────────────────────────────────────────────────────
  const GROUP_COLS = 12  // number of columns for group stage section
  const KO_COLS = 13

  for (const entry of entries ?? []) {
    // Excel sheet names: max 31 chars, no special chars
    const sheetName = entry.name.replace(/[\\\/\?\*\[\]:]/g, '').substring(0, 31)
    const ws = wb.addWorksheet(sheetName)

    ws.columns = [
      { width: 10 },  // 1: group / match#
      { width: 5 },   // 2: match#
      { width: 11 },  // 3: date
      { width: 22 },  // 4: home team
      { width: 6 },   // 5: pred home
      { width: 3 },   // 6: –
      { width: 6 },   // 7: pred away
      { width: 22 },  // 8: away team
      { width: 6 },   // 9: actual home
      { width: 3 },   // 10: –
      { width: 6 },   // 11: actual away
      { width: 10 },  // 12: winner / pred winner
      { width: 10 },  // 13: actual winner (KO only)
      { width: 9 },   // 14: res pts (shifted for KO)
      { width: 9 },   // 15: score pts
      { width: 9 },   // 16: total pts
    ]

    let row = 1

    // Title row
    ws.mergeCells(row, 1, row, 16)
    const titleCell = ws.getCell(row, 1)
    titleCell.value = `Quiniela 2026 — ${entry.name}`
    titleCell.font = { bold: true, size: 14, color: { argb: 'FFFFFF' } }
    titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '0F172A' } }
    titleCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 }
    ws.getRow(row).height = 24
    row++

    // Entry info row
    ws.getCell(row, 1).value = 'User:'
    ws.getCell(row, 1).font = { bold: true }
    ws.getCell(row, 2).value = entry.user_email
    ws.mergeCells(row, 2, row, 8)
    ws.getCell(row, 9).value = 'Total Points:'
    ws.getCell(row, 9).font = { bold: true }
    ws.mergeCells(row, 9, row, 11)
    ws.getCell(row, 12).value = entry.total_points
    ws.getCell(row, 12).font = { bold: true, size: 12, color: { argb: 'D97706' } }
    ws.getRow(row).height = 16
    row++

    row++ // blank

    // ── GROUP STAGE ────────────────────────────────────────────────────────────
    header(ws, row, 'GROUP STAGE', 12, '1E40AF')
    row++
    colHeaders(ws, row, [
      'Group', 'Match #', 'Date', 'Home Team', 'Pred', '–', 'Pred', 'Away Team',
      'Actual', '–', 'Actual', 'Pts',
    ])
    row++

    const groupMatches = matchesByRound['group_stage'] ?? []
    let totalGroupPts = 0
    let prevGroup = ''

    for (const m of groupMatches) {
      const grpRef = Array.isArray(m.group) ? m.group[0] : m.group
      const grpName = (grpRef as { name?: string })?.name ?? ''
      const pred = predByEntryMatch[entry.id]?.[m.id]
      const homeTeam = teamName(m.home_team) || m.placeholder_home || '?'
      const awayTeam = teamName(m.away_team) || m.placeholder_away || '?'
      const homeFlag = (Array.isArray(m.home_team) ? m.home_team[0] : m.home_team as { flag_emoji?: string } | null)?.flag_emoji ?? ''
      const awayFlag = (Array.isArray(m.away_team) ? m.away_team[0] : m.away_team as { flag_emoji?: string } | null)?.flag_emoji ?? ''

      const pts = pred?.points_awarded ?? null
      if (pts !== null) totalGroupPts += pts

      const isNewGroup = grpName !== prevGroup
      prevGroup = grpName

      if (isNewGroup && grpName) {
        // Subtle group separator
        const sepRow = ws.getRow(row)
        for (let c = 1; c <= 12; c++) {
          sepRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'EFF6FF' } }
        }
        sepRow.getCell(1).value = grpName
        sepRow.getCell(1).font = { bold: true, size: 9, color: { argb: '1D4ED8' } }
        ws.mergeCells(row, 1, row, 12)
        sepRow.height = 13
        row++
      }

      const r = ws.getRow(row)
      r.getCell(1).value = ''
      r.getCell(2).value = m.match_number
      r.getCell(2).alignment = { horizontal: 'center' }
      r.getCell(3).value = m.scheduled_at ? new Date(m.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
      r.getCell(3).alignment = { horizontal: 'center' }
      r.getCell(4).value = `${homeFlag} ${homeTeam}`.trim()
      r.getCell(5).value = pred?.predicted_home ?? ''
      r.getCell(5).alignment = { horizontal: 'center' }
      r.getCell(6).value = '–'
      r.getCell(6).alignment = { horizontal: 'center' }
      r.getCell(7).value = pred?.predicted_away ?? ''
      r.getCell(7).alignment = { horizontal: 'center' }
      r.getCell(8).value = `${awayFlag} ${awayTeam}`.trim()
      r.getCell(9).value = m.home_score ?? ''
      r.getCell(9).alignment = { horizontal: 'center' }
      r.getCell(10).value = '–'
      r.getCell(10).alignment = { horizontal: 'center' }
      r.getCell(11).value = m.away_score ?? ''
      r.getCell(11).alignment = { horizontal: 'center' }
      r.getCell(12).value = pts ?? ''
      r.getCell(12).alignment = { horizontal: 'center' }
      if (pts !== null && pts > 0) {
        r.getCell(12).font = { bold: true, color: { argb: '16A34A' } }
      }
      r.height = 15
      row++
    }

    // Group stage totals row
    const gsTotal = ws.getRow(row)
    for (let c = 1; c <= 12; c++) {
      gsTotal.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } }
    }
    ws.mergeCells(row, 1, row, 11)
    gsTotal.getCell(1).value = 'Group Stage Total'
    gsTotal.getCell(1).font = { bold: true }
    gsTotal.getCell(12).value = totalGroupPts || ''
    gsTotal.getCell(12).font = { bold: true, color: { argb: '1D4ED8' } }
    gsTotal.getCell(12).alignment = { horizontal: 'center' }
    gsTotal.height = 16
    row++

    row++ // blank

    // ── GROUP QUALIFICATIONS ───────────────────────────────────────────────────
    header(ws, row, 'GROUP QUALIFICATIONS', 7, '1E40AF')
    row++
    colHeaders(ws, row, ['Group', 'Predicted 1st', 'Predicted 2nd', 'Predicted 3rd', '', '', 'Points'])
    row++

    let totalQualPts = 0
    for (const g of groups ?? []) {
      const q = qualByEntryGroup[entry.id]?.[g.id]
      const pts = q?.points_awarded ?? null
      if (pts !== null) totalQualPts += pts

      const r = ws.getRow(row)
      r.getCell(1).value = `Group ${g.name}`
      r.getCell(1).font = { bold: true, size: 9 }
      r.getCell(2).value = teamName(q?.team_1st)
      r.getCell(3).value = teamName(q?.team_2nd)
      r.getCell(4).value = teamName(q?.team_3rd)
      r.getCell(7).value = pts ?? ''
      r.getCell(7).alignment = { horizontal: 'center' }
      if (pts !== null && pts > 0) {
        r.getCell(7).font = { bold: true, color: { argb: '16A34A' } }
      }
      r.height = 15
      row++
    }

    // Qual totals row
    const qtRow = ws.getRow(row)
    ws.mergeCells(row, 1, row, 6)
    qtRow.getCell(1).value = 'Qualifications Total'
    qtRow.getCell(1).font = { bold: true }
    for (let c = 1; c <= 7; c++) {
      qtRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } }
    }
    qtRow.getCell(7).value = totalQualPts || ''
    qtRow.getCell(7).font = { bold: true, color: { argb: '1D4ED8' } }
    qtRow.getCell(7).alignment = { horizontal: 'center' }
    qtRow.height = 16
    row++

    // ── KNOCKOUT ROUNDS ────────────────────────────────────────────────────────
    for (const roundName of ROUND_ORDER) {
      if (roundName === 'group_stage') continue
      const roundMatches = matchesByRound[roundName]
      if (!roundMatches?.length) continue

      row++
      header(ws, row, ROUND_LABELS[roundName as RoundName], 16, '1E40AF')
      row++
      colHeaders(ws, row, [
        'Match #', '', 'Date', 'Home Team', 'Pred', '–', 'Pred', 'Away Team',
        'Pred Winner', 'Actual', '–', 'Actual', 'Act Winner', 'Res Pts', 'Score Pts', 'Total',
      ])
      row++

      let roundTotal = 0
      for (const m of roundMatches) {
        const pred = predByEntryMatch[entry.id]?.[m.id]
        const homeTeam = teamName(m.home_team) || m.placeholder_home || '?'
        const awayTeam = teamName(m.away_team) || m.placeholder_away || '?'
        const homeFlag = (Array.isArray(m.home_team) ? m.home_team[0] : m.home_team as { flag_emoji?: string } | null)?.flag_emoji ?? ''
        const awayFlag = (Array.isArray(m.away_team) ? m.away_team[0] : m.away_team as { flag_emoji?: string } | null)?.flag_emoji ?? ''
        const predWinner = pred?.predicted_winner_team_id ? (teamById[pred.predicted_winner_team_id]?.name ?? '') : ''
        const actWinner = teamName(m.winner_team)
        const pts = pred?.points_awarded ?? null
        if (pts !== null) roundTotal += pts

        const r = ws.getRow(row)
        r.getCell(1).value = m.match_number
        r.getCell(1).alignment = { horizontal: 'center' }
        r.getCell(3).value = m.scheduled_at ? new Date(m.scheduled_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : ''
        r.getCell(3).alignment = { horizontal: 'center' }
        r.getCell(4).value = `${homeFlag} ${homeTeam}`.trim()
        r.getCell(5).value = pred?.predicted_home ?? ''
        r.getCell(5).alignment = { horizontal: 'center' }
        r.getCell(6).value = '–'
        r.getCell(6).alignment = { horizontal: 'center' }
        r.getCell(7).value = pred?.predicted_away ?? ''
        r.getCell(7).alignment = { horizontal: 'center' }
        r.getCell(8).value = `${awayFlag} ${awayTeam}`.trim()
        r.getCell(9).value = predWinner
        r.getCell(10).value = m.home_score ?? ''
        r.getCell(10).alignment = { horizontal: 'center' }
        r.getCell(11).value = '–'
        r.getCell(11).alignment = { horizontal: 'center' }
        r.getCell(12).value = m.away_score ?? ''
        r.getCell(12).alignment = { horizontal: 'center' }
        r.getCell(13).value = actWinner
        r.getCell(14).value = pts !== null ? (pts > 0 ? pts : 0) : ''
        r.getCell(14).alignment = { horizontal: 'center' }
        r.getCell(15).value = ''
        r.getCell(16).value = pts ?? ''
        r.getCell(16).alignment = { horizontal: 'center' }
        if (pts !== null && pts > 0) {
          r.getCell(16).font = { bold: true, color: { argb: '16A34A' } }
        }
        r.height = 15
        row++
      }

      // Round total row
      const rtRow = ws.getRow(row)
      for (let c = 1; c <= 16; c++) {
        rtRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DBEAFE' } }
      }
      ws.mergeCells(row, 1, row, 15)
      rtRow.getCell(1).value = `${ROUND_LABELS[roundName as RoundName]} Total`
      rtRow.getCell(1).font = { bold: true }
      rtRow.getCell(16).value = roundTotal || ''
      rtRow.getCell(16).font = { bold: true, color: { argb: '1D4ED8' } }
      rtRow.getCell(16).alignment = { horizontal: 'center' }
      rtRow.height = 16
      row++
    }

    // Freeze top row
    ws.views = [{ state: 'frozen', ySplit: 2 }]
  }

  // ── Respond ─────────────────────────────────────────────────────────────────
  const buffer = await wb.xlsx.writeBuffer()
  const date = new Date().toISOString().slice(0, 10)

  return new Response(buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="quiniela-${date}.xlsx"`,
    },
  })
}

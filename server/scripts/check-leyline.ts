import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

async function check() {
  const ownership = await sql`SELECT region_id, country_code FROM region_ownership ORDER BY country_code, region_id`
  console.log(`Total regions in ownership: ${ownership.length}`)

  const leyState = await sql`SELECT line_id, is_active, completion_pct, controller_type, effectiveness FROM ley_line_state ORDER BY line_id`
  console.log('\nAll Ley Line States:')
  leyState.forEach(l => console.log(`  ${l.line_id}: active=${l.is_active} completion=${l.completion_pct}% type=${l.controller_type} eff=${l.effectiveness}`))

  const buffs = await sql`SELECT country_code, active_line_ids, merged_bonuses FROM country_ley_line_buff ORDER BY country_code`
  console.log('\nAll Country Buffs:')
  buffs.forEach(b => console.log(`  ${b.country_code}: lines=${JSON.stringify(b.active_line_ids)}`))

  await sql.end()
}

check().catch(e => { console.error(e); process.exit(1) })

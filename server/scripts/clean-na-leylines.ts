import 'dotenv/config'
import postgres from 'postgres'

const sql = postgres(process.env.DATABASE_URL!, { max: 1 })

async function clean() {
  console.log('[CLEANUP] Removing NA ley lines from DB state...')
  
  await sql`DELETE FROM ley_line_node_state WHERE line_id IN ('NA-PROSPERITY', 'NA-DOMINION', 'NA-CONVERGENCE')`
  await sql`DELETE FROM ley_line_state WHERE line_id IN ('NA-PROSPERITY', 'NA-DOMINION', 'NA-CONVERGENCE')`
  
  // also recalculate country buffs by wiping them so the engine rebuilds cleanly
  await sql`DELETE FROM country_ley_line_buff`
  
  console.log('[CLEANUP] Done!')
  await sql.end()
}

clean().catch(console.error)

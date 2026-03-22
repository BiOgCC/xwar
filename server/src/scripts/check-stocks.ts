import 'dotenv/config'
import postgres from 'postgres'

const db = postgres(process.env.DATABASE_URL!)

// Check country_stocks
const stocks = await db`SELECT country_code, price, volume FROM country_stocks ORDER BY country_code`
console.log(`country_stocks rows: ${stocks.length}`)
for (const s of stocks) console.log(`  ${s.country_code}  price=${s.price}  vol=${s.volume}`)

// Check countries
const countries = await db`SELECT code FROM countries ORDER BY code`
console.log(`\ncountries rows: ${countries.length}`)
const stockCodes = new Set(stocks.map(s => s.country_code))
const missing = countries.filter(c => !stockCodes.has(c.code))
console.log(`\nMissing from country_stocks: ${missing.length}`)
for (const m of missing) console.log(`  ${m.code}`)

await db.end()

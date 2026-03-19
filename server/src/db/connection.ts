import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL!

// For query purposes
const queryClient = postgres(connectionString)
export const db = drizzle(queryClient, { schema })

// For migrations (uses a separate connection)
export function getMigrationClient() {
  return postgres(connectionString, { max: 1 })
}

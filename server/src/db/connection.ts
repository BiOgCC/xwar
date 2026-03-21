import 'dotenv/config'
import postgres from 'postgres'
import { drizzle } from 'drizzle-orm/postgres-js'
import * as schema from './schema.js'

const connectionString = process.env.DATABASE_URL!

// For query purposes (Connection Pooling enabled: default max 10, raised to 50 for expected concurrent users)
const queryClient = postgres(connectionString, { 
  max: 50,
  idle_timeout: 20
})
export const db = drizzle(queryClient, { schema })

// For migrations (uses a separate single connection)
export function getMigrationClient() {
  return postgres(connectionString, { max: 1 })
}

import { generateFixtures, verifyFixtures } from './fixtures'

/** Generates the PDF fixtures fresh for every run (see fixtures.ts) and verifies them before any spec starts. */
export default async function globalSetup(): Promise<void> {
  await generateFixtures()
  await verifyFixtures()
}

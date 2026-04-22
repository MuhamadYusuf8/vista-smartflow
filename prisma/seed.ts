import { PrismaClient, Role } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pkg from 'pg'
const { Pool } = pkg
import bcrypt from 'bcryptjs'
import { generateCameras, generateViolations } from '../lib/mock-data.js'
import 'dotenv/config'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })
const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Seeding data...')
  
  // Clear existing data
  await prisma.systemLog.deleteMany({})
  await prisma.heatmapData.deleteMany({})
  await prisma.violation.deleteMany({})
  await prisma.camera.deleteMany({})
  await prisma.user.deleteMany({})
  
  // Create test users
  const adminPassword = await bcrypt.hash('admin123', 10)
  const officerPassword = await bcrypt.hash('officer123', 10)
  const viewerPassword = await bcrypt.hash('viewer123', 10)
  
  await prisma.user.create({
    data: {
      name: 'System Admin',
      email: 'admin@dishub.go.id',
      password: adminPassword,
      role: Role.ADMIN
    }
  })
  
  await prisma.user.create({
    data: {
      name: 'Field Officer',
      email: 'officer@dishub.go.id',
      password: officerPassword,
      role: Role.OFFICER
    }
  })
  
  await prisma.user.create({
    data: {
      name: 'Dashboard Viewer',
      email: 'viewer@dishub.go.id',
      password: viewerPassword,
      role: Role.VIEWER
    }
  })
  
  console.log('Users created.')
  
  // Create cameras
  const camerasData = generateCameras()
  
  const createdCameras = await Promise.all(
    camerasData.map(c => prisma.camera.create({ data: c }))
  )
  
  console.log(`Created ${createdCameras.length} cameras.`)
  
  // Create violations
  const cameraIds = createdCameras.map(c => c.id)
  const violationsData = generateViolations(cameraIds)
  
  // Inject proper camera locations
  for (const v of violationsData) {
    const cam = createdCameras.find(c => c.id === v.cameraId)
    if (cam) {
      v.location = `Terdeteksi di sekitar ${cam.location}`
    }
  }

  // Batch insert violations to avoid query limits
  const BATCH_SIZE = 50;
  for (let i = 0; i < violationsData.length; i += BATCH_SIZE) {
    const batch = violationsData.slice(i, i + BATCH_SIZE);
    await prisma.violation.createMany({ data: batch });
  }
  
  console.log(`Created ${violationsData.length} violations.`)
  
  console.log('Seeding completed successfully.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })

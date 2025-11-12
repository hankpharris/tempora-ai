import { PrismaClient, UserType, FriendshipStatus } from "@prisma/client"
import { readFileSync } from "fs"
import { join } from "path"
import { parse } from "csv-parse/sync"
import bcrypt from "bcryptjs"

const prisma = new PrismaClient()

interface UserRow {
  id: string
  email: string
  emailVerified: string | null
  name: string | null
  image: string | null
  type: string
  createdAt: string
  updatedAt: string
}

interface FriendshipRow {
  user_id1: string
  user_id2: string
  status: string
  created_at: string
}

interface ScheduleRow {
  id: string
  user_id: string
  name: string
  createdAt: string
  updatedAt: string
}

interface EventRow {
  id: string
  schedule_id: string
  start: string
  end: string
  createdAt: string
  updatedAt: string
}

function parseCSV<T>(filePath: string): T[] {
  const content = readFileSync(filePath, "utf-8")
  const records = parse(content, {
    columns: true,
    skip_empty_lines: true,
  })
  return records as T[]
}

async function seed() {
  console.log("🌱 Starting database seed...")

  try {
    // Clear existing data (in reverse order of dependencies)
    console.log("🧹 Clearing existing data...")
    await prisma.event.deleteMany()
    await prisma.schedule.deleteMany()
    await prisma.friendship.deleteMany()
    await prisma.user.deleteMany()

    // Seed Users
    console.log("👤 Seeding users...")
    const usersPath = join(process.cwd(), "prisma", "seed-data", "users.csv")
    const userRows = parseCSV<UserRow>(usersPath)

    for (const row of userRows) {
      await prisma.user.create({
        data: {
          id: row.id,
          email: row.email,
          emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
          name: row.name || null,
          image: row.image || null,
          type: row.type as UserType,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
      })
    }
    console.log(`✅ Created ${userRows.length} users`)

    // Create henry admin user with encrypted password
    console.log("👑 Creating henry admin user...")
    const hashedPassword = await bcrypt.hash("admin123", 10)
    await prisma.user.upsert({
      where: { email: "henry@admin.com" },
      update: {
        password: hashedPassword,
        type: UserType.ADMIN,
        name: "Henry",
      },
      create: {
        id: "henry-admin",
        email: "henry@admin.com",
        password: hashedPassword,
        name: "Henry",
        type: UserType.ADMIN,
        emailVerified: new Date(),
      },
    })
    console.log("✅ Created henry admin user")
    console.log("📧 Login credentials:")
    console.log("   Email: henry@admin.com")
    console.log("   Password: admin123")

    // Seed Friendships
    console.log("🤝 Seeding friendships...")
    const friendshipsPath = join(process.cwd(), "prisma", "seed-data", "friendships.csv")
    const friendshipRows = parseCSV<FriendshipRow>(friendshipsPath)

    for (const row of friendshipRows) {
      await prisma.friendship.create({
        data: {
          user_id1: row.user_id1,
          user_id2: row.user_id2,
          status: row.status as FriendshipStatus,
          createdAt: new Date(row.created_at),
        },
      })
    }
    console.log(`✅ Created ${friendshipRows.length} friendships`)

    // Seed Schedules
    console.log("📅 Seeding schedules...")
    const schedulesPath = join(process.cwd(), "prisma", "seed-data", "schedules.csv")
    const scheduleRows = parseCSV<ScheduleRow>(schedulesPath)

    for (const row of scheduleRows) {
      await prisma.schedule.create({
        data: {
          id: row.id,
          userId: row.user_id,
          name: row.name,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
      })
    }
    console.log(`✅ Created ${scheduleRows.length} schedules`)

    // Seed Events
    console.log("📆 Seeding events...")
    const eventsPath = join(process.cwd(), "prisma", "seed-data", "events.csv")
    const eventRows = parseCSV<EventRow>(eventsPath)

    for (const row of eventRows) {
      await prisma.event.create({
        data: {
          id: row.id,
          scheduleId: row.schedule_id,
          start: new Date(row.start),
          end: new Date(row.end),
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
      })
    }
    console.log(`✅ Created ${eventRows.length} events`)

    console.log("🎉 Database seed completed successfully!")
  } catch (error) {
    console.error("❌ Error seeding database:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

seed()
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })


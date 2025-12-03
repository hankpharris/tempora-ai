import { FriendshipStatus, PrismaClient, RepeatFrequency, UserType } from "@prisma/client"
import { parse } from "csv-parse/sync"
import bcrypt from "bcryptjs"
import { readFileSync } from "fs"
import { join } from "path"

const prisma = new PrismaClient()

interface UserRow {
  id: string
  email: string
  emailVerified: string | null
  fname: string | null
  lname: string | null
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
  name: string
  description: string | null
  start: string // JSON array of ISO timestamps
  end: string   // JSON array of ISO timestamps
  repeated: string
  repeatUntil: string | null
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

    // Store mapping from CSV ID to generated ID for foreign key references
    const userIdMap = new Map<string, string>()

    for (const row of userRows) {
      const user = await prisma.user.create({
        data: {
          // Let Prisma auto-generate the cuid() for proper primary key generation
          email: row.email,
          emailVerified: row.emailVerified ? new Date(row.emailVerified) : null,
          fname: row.fname || null,
          lname: row.lname || null,
          image: row.image || null,
          type: row.type as UserType,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
      })
      userIdMap.set(row.id, user.id)
    }
    console.log(`✅ Created ${userRows.length} users`)

    // Create henry admin user with encrypted password
    console.log("👑 Creating henry admin user...")
    const hashedPassword = await bcrypt.hash("admin123", 10)
    const henryAdmin = await prisma.user.upsert({
      where: { email: "henry@admin.com" },
      update: {
        password: hashedPassword,
        type: UserType.ADMIN,
        fname: "Henry",
        lname: "Admin",
      },
      create: {
        email: "henry@admin.com",
        password: hashedPassword,
        fname: "Henry",
        lname: "Admin",
        type: UserType.ADMIN,
        emailVerified: new Date(),
      },
    })
    // Add henry-admin to userIdMap so schedules/events can reference it
    userIdMap.set("henry-admin", henryAdmin.id)
    console.log("✅ Created henry admin user")
    console.log("📧 Login credentials:")
    console.log("   Email: henry@admin.com")
    console.log("   Password: admin123")

    // Seed Friendships
    console.log("🤝 Seeding friendships...")
    const friendshipsPath = join(process.cwd(), "prisma", "seed-data", "friendships.csv")
    const friendshipRows = parseCSV<FriendshipRow>(friendshipsPath)

    for (const row of friendshipRows) {
      const mappedUserId1 = userIdMap.get(row.user_id1)
      const mappedUserId2 = userIdMap.get(row.user_id2)
      
      if (!mappedUserId1 || !mappedUserId2) {
        console.warn(`⚠️ Skipping friendship: user IDs ${row.user_id1} or ${row.user_id2} not found`)
        continue
      }

      await prisma.friendship.create({
        data: {
          user_id1: mappedUserId1,
          user_id2: mappedUserId2,
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

    // Store mapping from CSV ID to generated ID for event foreign key references
    const scheduleIdMap = new Map<string, string>()

    for (const row of scheduleRows) {
      const mappedUserId = userIdMap.get(row.user_id)
      
      if (!mappedUserId) {
        console.warn(`⚠️ Skipping schedule: user ID ${row.user_id} not found`)
        continue
      }

      const schedule = await prisma.schedule.create({
        data: {
          // Let Prisma auto-generate the cuid() for proper primary key generation
          userId: mappedUserId,
          name: row.name,
          createdAt: new Date(row.createdAt),
          updatedAt: new Date(row.updatedAt),
        },
      })
      scheduleIdMap.set(row.id, schedule.id)
    }
    console.log(`✅ Created ${scheduleRows.length} schedules`)

    // Seed Events
    console.log("📆 Seeding events...")
    const eventsPath = join(process.cwd(), "prisma", "seed-data", "events.csv")
    const eventRows = parseCSV<EventRow>(eventsPath)

    for (const row of eventRows) {
      const mappedScheduleId = scheduleIdMap.get(row.schedule_id)
      
      if (!mappedScheduleId) {
        console.warn(`⚠️ Skipping event: schedule ID ${row.schedule_id} not found`)
        continue
      }

      // Parse JSON arrays for start and end times
      const startTimes = (JSON.parse(row.start) as string[]).map((t) => new Date(t))
      const endTimes = (JSON.parse(row.end) as string[]).map((t) => new Date(t))

      if (startTimes.length !== endTimes.length) {
        console.warn(`⚠️ Skipping event ${row.name}: start and end arrays must have same length`)
        continue
      }

      await prisma.event.create({
        data: {
          // Let Prisma auto-generate the cuid() for proper primary key generation
          scheduleId: mappedScheduleId,
          name: row.name,
          description: row.description || null,
          start: startTimes,
          end: endTimes,
          repeated: row.repeated as RepeatFrequency,
          repeatUntil: row.repeatUntil ? new Date(row.repeatUntil) : null,
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


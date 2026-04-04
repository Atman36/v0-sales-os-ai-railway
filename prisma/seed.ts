import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { assertSeedExecutionAllowed, requireSeedWebhookSecret, resolveSeedConfig } from './seed-runtime'

const prisma = new PrismaClient()

async function main() {
  assertSeedExecutionAllowed()

  const { adminEmail, adminPassword, adminName, timezone, demoManagers, demoManagerPassword } = resolveSeedConfig()
  const webhookSecret = requireSeedWebhookSecret()

  const passwordHash = await bcrypt.hash(adminPassword, 10)

  // Admin user — no managerId
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: 'ADMIN',
      passwordHash,
    },
    create: {
      email: adminEmail,
      name: adminName,
      role: 'ADMIN',
      passwordHash,
    },
  })

  const existingConfig = await prisma.tenantConfig.findFirst()
  if (!existingConfig) {
    await prisma.tenantConfig.create({
      data: {
        timezone,
        webhookSecret,
        funnelStageMapping: {},
        managerMapping: {},
        planDefaults: {},
      },
    })
  } else {
    const updateData: { timezone?: string; webhookSecret?: string } = {}
    if (timezone) updateData.timezone = timezone
    if (webhookSecret) updateData.webhookSecret = webhookSecret
    if (Object.keys(updateData).length > 0) {
      await prisma.tenantConfig.update({
        where: { id: existingConfig.id },
        data: updateData,
      })
    }
  }

  // Demo manager accounts (only seeded if SEED_DEMO_MANAGERS=true)
  if (process.env.SEED_DEMO_MANAGERS === 'true') {
    for (const mgr of demoManagers) {
      const manager = await prisma.manager.upsert({
        where: { externalId: mgr.externalId },
        update: { name: mgr.name },
        create: { name: mgr.name, externalId: mgr.externalId },
      })

      const userEmail = `${mgr.externalId}@salesos.ai`
      const userPasswordHash = await bcrypt.hash(demoManagerPassword, 10)

      // Create user without managerId first (to avoid unique conflict on upsert)
      const existingUser = await prisma.user.findUnique({ where: { email: userEmail } })
      if (!existingUser) {
        await prisma.user.create({
          data: {
            email: userEmail,
            name: mgr.name,
            role: 'USER',
            passwordHash: userPasswordHash,
            managerId: manager.id,
          },
        })
      } else if (existingUser.managerId !== manager.id) {
        await prisma.user.update({
          where: { email: userEmail },
          data: { managerId: manager.id },
        })
      }
    }
  }
}

main()
  .catch((error) => {
    console.error('Seed failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

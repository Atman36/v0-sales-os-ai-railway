import { PrismaClient } from '@prisma/client'
import { DEFAULT_INSECURE_SECRET, isDefaultSecret, isSafeEnv, normalizeSecret, resolveNodeEnv } from '@shared/runtime-env'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const adminEmail = process.env.ADMIN_EMAIL ?? 'admin@salesos.ai'
  const adminPassword = process.env.ADMIN_PASSWORD ?? 'admin123'
  const adminName = process.env.ADMIN_NAME ?? 'Admin'
  const timezone = process.env.TENANT_TIMEZONE ?? 'UTC'
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
    const demoManagers = [
      { name: 'Алексей Петров', externalId: 'mgr-001' },
      { name: 'Мария Иванова', externalId: 'mgr-002' },
      { name: 'Дмитрий Козлов', externalId: 'mgr-003' },
    ]

    for (const mgr of demoManagers) {
      const manager = await prisma.manager.upsert({
        where: { externalId: mgr.externalId },
        update: { name: mgr.name },
        create: { name: mgr.name, externalId: mgr.externalId },
      })

      const userEmail = `${mgr.externalId}@salesos.ai`
      const userPasswordHash = await bcrypt.hash('manager123', 10)

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

function requireSeedWebhookSecret() {
  const nodeEnv = resolveNodeEnv(process.env.NODE_ENV)
  const secret = normalizeSecret(process.env.SALESOS_WEBHOOK_SECRET)

  if (secret) {
    if (!isSafeEnv(nodeEnv) && isDefaultSecret(secret)) {
      throw new Error(`SALESOS_WEBHOOK_SECRET must be changed outside development/test (NODE_ENV=${nodeEnv})`)
    }
    return secret
  }

  if (isSafeEnv(nodeEnv)) {
    return DEFAULT_INSECURE_SECRET
  }

  throw new Error(`SALESOS_WEBHOOK_SECRET is required outside development/test (NODE_ENV=${nodeEnv})`)
}

main()
  .catch((error) => {
    console.error('Seed failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

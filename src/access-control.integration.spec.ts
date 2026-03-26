import { Injectable, Module, type INestApplication } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'
import { JwtService } from '@nestjs/jwt'
import { PassportModule } from '@nestjs/passport'
import { PassportStrategy } from '@nestjs/passport'
import { ExtractJwt, Strategy } from 'passport-jwt'
import { DashboardController } from './dashboard/dashboard.controller'
import { DashboardService } from './dashboard/dashboard.service'
import { ManagersController } from './managers/managers.controller'
import { ManagersService } from './managers/managers.service'
import { ReportsController } from './reports/reports.controller'
import { ReportsService } from './reports/reports.service'
import { AIInsightsController } from './ai/ai.controller'
import { AIInsightsService } from './ai/ai.service'
import type { CurrentAuthUser } from './auth/access-control'

const adminUser: CurrentAuthUser = {
  sub: 'admin-1',
  email: 'admin@example.com',
  role: 'admin',
  managerId: null,
}

const managerUser: CurrentAuthUser = {
  sub: 'user-1',
  email: 'manager@example.com',
  role: 'user',
  managerId: 'manager-1',
}

const dashboardService = {
  getDashboard: jest.fn(async (from: Date, to: Date) => ({
    scope: 'dashboard',
    from: from.toISOString(),
    to: to.toISOString(),
  })),
}

const managersService = {
  getManager: jest.fn(async (managerId: string, month: string, dailyFrom?: string) => ({
    managerId,
    month,
    dailyFrom: dailyFrom ?? null,
  })),
}

const reportsService = {
  getLatestManagerReport: jest.fn(async (managerId: string) => ({
    managerId,
    reportId: `latest-${managerId}`,
  })),
}

const aiInsightsService = {
  listInsights: jest.fn(async (scope?: 'TEAM' | 'MANAGER', managerId?: string) => ({
    scope: scope ?? 'MANAGER',
    managerId: managerId ?? null,
  })),
}

@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: true,
      secretOrKey: 'test-secret',
    })
  }

  validate(payload: CurrentAuthUser) {
    return payload
  }
}

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [DashboardController, ManagersController, ReportsController, AIInsightsController],
  providers: [
    TestJwtStrategy,
    { provide: DashboardService, useValue: dashboardService },
    { provide: ManagersService, useValue: managersService },
    { provide: ReportsService, useValue: reportsService },
    { provide: AIInsightsService, useValue: aiInsightsService },
  ],
})
class AccessControlIntegrationTestModule {}

type RequestUser = CurrentAuthUser
let baseUrl = ''
const jwt = new JwtService({ secret: 'test-secret' })

async function requestJson(path: string, user: RequestUser) {
  const token = jwt.sign(user)
  const response = await fetch(`${baseUrl}${path}`, {
    headers: {
      authorization: `Bearer ${token}`,
    },
  })

  const contentType = response.headers.get('content-type') ?? ''
  const body = contentType.includes('application/json') ? await response.json() : await response.text()

  return { response, body }
}
describe('Access control integration', () => {
  let app: INestApplication

  beforeAll(async () => {
    app = await NestFactory.create(AccessControlIntegrationTestModule, {
      logger: ['error', 'warn'],
    })
    await app.listen(0, '127.0.0.1')
    baseUrl = await app.getUrl()
  })

  afterAll(async () => {
    await app.close()
  })

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('lets admin read dashboard and blocks manager', async () => {
    const adminResult = await requestJson('/dashboard?from=2026-03-01&to=2026-03-31', adminUser)
    expect(adminResult.response.status).toBe(200)
    expect(adminResult.body).toMatchObject({ scope: 'dashboard' })
    expect(dashboardService.getDashboard).toHaveBeenCalledWith(new Date('2026-03-01'), new Date('2026-03-31'))

    const managerResult = await requestJson('/dashboard?from=2026-03-01&to=2026-03-31', managerUser)
    expect(managerResult.response.status).toBe(403)
    expect(dashboardService.getDashboard).toHaveBeenCalledTimes(1)
  })

  it('keeps manager access to /managers/:id bound to own managerId while admin can read any manager', async () => {
    const adminResult = await requestJson('/managers/manager-2?month=2026-03', adminUser)
    expect(adminResult.response.status).toBe(200)
    expect(adminResult.body).toEqual({
      managerId: 'manager-2',
      month: '2026-03',
      dailyFrom: null,
    })

    const ownManagerResult = await requestJson('/managers/manager-1?month=2026-03', managerUser)
    expect(ownManagerResult.response.status).toBe(200)
    expect(ownManagerResult.body).toEqual({
      managerId: 'manager-1',
      month: '2026-03',
      dailyFrom: null,
    })

    const foreignManagerResult = await requestJson('/managers/manager-2?month=2026-03', managerUser)
    expect(foreignManagerResult.response.status).toBe(403)
    expect(managersService.getManager).toHaveBeenNthCalledWith(1, 'manager-2', '2026-03', undefined)
    expect(managersService.getManager).toHaveBeenNthCalledWith(2, 'manager-1', '2026-03', undefined)
  })

  it('keeps /reports/latest/:managerId admin-readable while managers can only read own latest report', async () => {
    const adminResult = await requestJson('/reports/latest/manager-2', adminUser)
    expect(adminResult.response.status).toBe(200)
    expect(adminResult.body).toEqual({
      managerId: 'manager-2',
      reportId: 'latest-manager-2',
    })

    const ownManagerResult = await requestJson('/reports/latest/manager-1', managerUser)
    expect(ownManagerResult.response.status).toBe(200)
    expect(ownManagerResult.body).toEqual({
      managerId: 'manager-1',
      reportId: 'latest-manager-1',
    })

    const foreignManagerResult = await requestJson('/reports/latest/manager-2', managerUser)
    expect(foreignManagerResult.response.status).toBe(403)
    expect(reportsService.getLatestManagerReport).toHaveBeenNthCalledWith(1, 'manager-2')
    expect(reportsService.getLatestManagerReport).toHaveBeenNthCalledWith(2, 'manager-1')
  })

  it('allows admin to read TEAM and MANAGER insights while managers stay pinned to own manager scope', async () => {
    const adminTeamResult = await requestJson('/ai/insights?scope=TEAM', adminUser)
    expect(adminTeamResult.response.status).toBe(200)
    expect(adminTeamResult.body).toEqual({
      scope: 'TEAM',
      managerId: null,
    })

    const adminManagerResult = await requestJson('/ai/insights?scope=MANAGER&managerId=manager-2', adminUser)
    expect(adminManagerResult.response.status).toBe(200)
    expect(adminManagerResult.body).toEqual({
      scope: 'MANAGER',
      managerId: 'manager-2',
    })

    const ownManagerResult = await requestJson('/ai/insights', managerUser)
    expect(ownManagerResult.response.status).toBe(200)
    expect(ownManagerResult.body).toEqual({
      scope: 'MANAGER',
      managerId: 'manager-1',
    })

    const foreignManagerResult = await requestJson('/ai/insights?scope=MANAGER&managerId=manager-2', managerUser)
    expect(foreignManagerResult.response.status).toBe(403)

    const teamResult = await requestJson('/ai/insights?scope=TEAM', managerUser)
    expect(teamResult.response.status).toBe(403)

    expect(aiInsightsService.listInsights).toHaveBeenNthCalledWith(1, 'TEAM', undefined)
    expect(aiInsightsService.listInsights).toHaveBeenNthCalledWith(2, 'MANAGER', 'manager-2')
    expect(aiInsightsService.listInsights).toHaveBeenNthCalledWith(3, 'MANAGER', 'manager-1')
  })
})

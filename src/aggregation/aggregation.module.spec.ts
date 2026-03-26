import 'reflect-metadata'
import { TenantConfigModule } from '../config/tenant-config.module'
import { LoggerModule } from '../logger/logger.module'
import { AggregationModule } from './aggregation.module'

describe('AggregationModule', () => {
  it('imports TenantConfigModule for AggregationService dependencies', () => {
    const imports = Reflect.getMetadata('imports', AggregationModule) ?? []

    expect(imports).toContain(TenantConfigModule)
    expect(imports).toContain(LoggerModule)
  })
})

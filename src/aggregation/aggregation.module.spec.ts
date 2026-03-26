import 'reflect-metadata'
import { TenantConfigModule } from '../config/tenant-config.module'
import { LoggerModule } from '../logger/logger.module'
import { AggregationModule } from './aggregation.module'

const resolveModuleImports = (target: object) =>
  ((Reflect.getMetadata('imports', target) ?? []) as Array<any>).map((entry) =>
    typeof entry?.forwardRef === 'function' ? entry.forwardRef() : entry,
  )

describe('AggregationModule', () => {
  it('imports TenantConfigModule for AggregationService dependencies', () => {
    const imports = resolveModuleImports(AggregationModule)

    expect(imports).toContain(TenantConfigModule)
    expect(imports).toContain(LoggerModule)
  })
})

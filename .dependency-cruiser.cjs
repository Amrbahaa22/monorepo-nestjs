/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
    forbidden: [
      {
        name: 'domain-no-io',
        comment: 'packages/domain must stay pure — no framework or infra imports',
        severity: 'error',
        from: { path: '^packages/domain' },
        to: {
          path: [
            '^packages/contracts',
            '^packages/platform',
            '^apps',
            'kafkajs',
            'drizzle-orm',
            'ioredis',
            '@nestjs',
            '@aws-sdk'
          ]
        }
      },
      {
        name: 'contracts-zod-only',
        comment: 'packages/contracts depends on zod only',
        severity: 'error',
        from: { path: '^packages/contracts' },
        to: {
          path: ['^packages/domain', '^packages/platform', '^apps'],
          pathNot: ['^packages/contracts']
        }
      },
      {
        name: 'platform-no-apps',
        comment: 'platform adapters never depend on a deployable app',
        severity: 'error',
        from: { path: '^packages/platform' },
        to: { path: '^apps' }
      }
    ],
    options: {
      tsPreCompilationDeps: true,
      tsConfig: { fileName: 'tsconfig.base.json' },
      enhancedResolveOptions: { exportsFields: ['exports'], conditionNames: ['import', 'require'] }
    }
  };
import { execFileSync } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { fileURLToPath } from 'node:url'

async function main() {
// 仅连接自行启动的无端口隔离容器，不读取任何 Supabase 凭据或业务连接串。
  const projectRoot = fileURLToPath(new URL('../../', import.meta.url))
  const options = process.argv.slice(2)
  const keep = options.includes('--keep')
  const containerFlag = options.indexOf('--container')
  const container = containerFlag >= 0 ? options[containerFlag + 1] : `resume-template-pg-${Date.now()}`
  if (!container || !/^resume-template-[a-z0-9-]+$/.test(container))
    throw new Error('隔离容器名必须以 resume-template- 开头')
  const database = `resume_template_${Date.now()}`
  const temporary = await mkdtemp(join(tmpdir(), 'resume-template-db-'))
  const artifacts = join(projectRoot, 'tests/resume-template/artifacts')
  await mkdir(artifacts, { recursive: true })
  const log = []
  let created = false
  let image = 'postgres:17'
  const availableImages = [image, 'public.ecr.aws/supabase/postgres:17.6.1.021']
  function run(command, argumentsList, input) {
    return execFileSync(command, argumentsList, {
      cwd: projectRoot,
      input,
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
      stdio: ['pipe', 'pipe', 'pipe'],
    })
  }
  const sql = (input, target = database) => run('docker', ['exec', '-i', container, 'psql', '-X', '-v', 'ON_ERROR_STOP=1', '-U', 'postgres', '-d', target], input)
  try {
    let exists = false
    try {
      const actualImage = run('docker', ['inspect', '--format', '{{.Config.Image}}', container]).trim()
      exists = availableImages.includes(actualImage)
      if (!exists)
        throw new Error('同名容器不是受控 PostgreSQL 17 隔离环境')
      image = actualImage
    }
    catch {}
    if (!exists) {
      for (const candidate of availableImages) {
        try {
          run('docker', ['image', 'inspect', candidate])
          image = candidate
          break
        }
        catch {}
      }
      run('docker', ['run', '--name', container, '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', '-e', 'POSTGRES_USER=postgres', '-d', image, 'postgres'])
      created = true
    }
    let ready = false
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        run('docker', ['exec', container, 'pg_isready', '-U', 'postgres'])
        ready = true
        break
      }
      catch { await setTimeout(500) }
    }
    if (!ready)
      throw new Error('隔离 PostgreSQL 未就绪')
    sql(`create database ${database};`, 'postgres')
    sql(`do $$ begin
    if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
    if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
    if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
  end $$;`)
    for (const migration of [
      '20261022123805_official_resume_template_resources.sql',
      '20261022124750_index_official_template_catalog_version.sql',
      '20261022142621_declarative_resume_templates.sql',
    ]) {
      log.push(`MIGRATION ${migration}\n${sql(await readFile(join(projectRoot, 'supabase/migrations', migration), 'utf8'))}`)
    }
    const release = join(temporary, 'release.sql')
    run(process.execPath, ['scripts/build-template-seed.ts', release, '--allow-missing-previews'])
    const payload = await readFile(release, 'utf8')
    log.push(`PUBLISH\n${sql(payload)}`)
    // 相同资源再次发布必须通过哈希核验，不允许覆盖不可变版本。
    log.push(`IDEMPOTENT REPUBLISH\n${sql(payload)}`)
    log.push(`ASSERTIONS\n${sql(await readFile(join(projectRoot, 'tests/resume-template/database.sql'), 'utf8'))}`)
    await writeFile(join(artifacts, 'database-output.txt'), `${log.join('\n')}\n`)
    await writeFile(join(artifacts, 'database-report.json'), `${JSON.stringify({
      passed: true,
      container,
      database,
      image,
      kept: keep || !created,
      migrations: ['20261022123805', '20261022124750', '20261022142621'],
      checks: ['v2 identity', 'existing example hashes', 'idempotent resource publication', 'asset integrity', 'template asset dependencies', 'exact preview dependencies', 'anon/auth read-only grants and RLS', 'template/example/asset drafts', 'published immutability', 'unlisting exact reads', '1000-row pagination'],
    }, null, 2)}\n`)
    process.stdout.write(`PASS isolated PostgreSQL 17: ${container}/${database}\n`)
  }
  catch (error) {
    const details = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr) : String(error)
    log.push(`FAIL\n${details}`)
    await writeFile(join(artifacts, 'database-output.txt'), `${log.join('\n')}\n`)
    process.stderr.write(details)
    throw error
  }
  finally {
    await rm(temporary, { recursive: true, force: true })
    if (created && !keep)
      run('docker', ['rm', '-fv', container])
  }
}
main().catch(() => {
  process.exitCode = 1
})
